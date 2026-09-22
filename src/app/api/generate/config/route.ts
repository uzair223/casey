import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Allow, parse } from "partial-json";
import { z } from "zod";

import { requireUser } from "@/lib/api-utils/auth";
import { paidAiDenial } from "@/lib/billing/paid-plan";
import { badRequest } from "@/lib/api-utils/response";
import { logServerEvent } from "@/lib/observability/logger";
import { selectModel } from "@/lib/llm/model-config";
import { streamResponsesText } from "@/lib/llm/openai-responses";
import type { ResponseFormatTextConfig } from "openai/resources/responses/responses";
import {
  getCloudflareAiClientOptions,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";

const client = new OpenAI(getCloudflareAiClientOptions());

const RequestBodySchema = z.object({
  input: z.string().trim().min(1, "input is required"),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
  seedData: z.unknown().optional(),
  responseFormat: z.looseObject({
    type: z.literal("json_schema"),
    json_schema: z.looseObject({
      name: z.string(),
    }),
  }),
});

function safeEnqueue(
  controller: ReadableStreamDefaultController,
  chunk: Uint8Array,
): boolean {
  try {
    controller.enqueue(chunk);
    return true;
  } catch (error) {
    const err = error as { code?: string };
    if (err?.code === "ERR_INVALID_STATE") {
      return false;
    }
    throw error;
  }
}

function safeClose(controller: ReadableStreamDefaultController) {
  try {
    controller.close();
  } catch {
    // Ignore close errors when stream is already closed/cancelled.
  }
}

function toResponsesTextFormat(responseFormat: {
  type: "json_schema";
  json_schema: {
    name: string;
    schema?: Record<string, unknown>;
    strict?: boolean | null;
    description?: string;
  };
}): ResponseFormatTextConfig {
  return {
    type: "json_schema",
    name: responseFormat.json_schema.name,
    schema: responseFormat.json_schema.schema ?? {
      type: "object",
      additionalProperties: true,
    },
    strict: responseFormat.json_schema.strict ?? null,
    description: responseFormat.json_schema.description,
  };
}

function safeParsePartialObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = parse(raw, Allow.OBJ | Allow.STR);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  if (!isCloudflareAiConfigured()) {
    await logServerEvent("error", "api.generate.config.misconfigured", {
      requestId,
      reason: "missing_cloudflare_ai_credentials",
    });
    return NextResponse.json(
      {
        error: "Cloudflare AI is not configured.",
      },
      { status: 500 },
    );
  }

  try {
    const auth = await requireUser(request);
    const denied = await paidAiDenial({
      role: auth.profile.role,
      tenantId: auth.profile.tenant_id,
    });
    if (denied) return denied;

    const rawBody = await request.json().catch(() => null);
    const body = RequestBodySchema.safeParse(rawBody);

    if (!body.success) {
      return badRequest(
        body.error.issues.map((el) => `${el.path}: ${el.message}`).join("\n") ??
          "Invalid payload",
      );
    }

    const { input, conversationHistory, seedData, responseFormat } = body.data;

    const encoder = new TextEncoder();
    const selectedModel = selectModel("template-generation");

    await logServerEvent("info", "api.generate.config.request", {
      requestId,
      model: selectedModel,
      userId: auth.userId,
      inputLength: input.length,
      conversationLength: conversationHistory.length,
    });

    let completionStream: AsyncIterable<string>;

    try {
      completionStream = await streamResponsesText({
        client,
        model: selectedModel,
        temperature: 0.2,
        promptCacheKey: `template:${auth.userId}`,
        instructions: `You are a JSON object generation agent.
Decide whether the user is asking for generation/edit actions or general conversation.
If the user asks for generation/edit actions, respond with {"kind":"patch","message":"...","data":{...}}.
If the user is asking a general question or giving conversational input, respond with {"kind":"message","message":"...","data":null}.
Use seedData only as the current draft state. Preserve all unrelated fields exactly as-is and make only the requested changes.`,
        textFormat: toResponsesTextFormat(responseFormat),
        input: [
          ...conversationHistory,
          {
            role: "user",
            content: input,
          },
          ...(seedData
            ? [
                {
                  role: "user" as const,
                  content: `Current object: ${JSON.stringify(seedData)}`,
                },
              ]
            : []),
        ],
      });
    } catch (error) {
      await logServerEvent("error", "api.generate.config.model_call_failed", {
        requestId,
        model: selectedModel,
        error,
      });
      return NextResponse.json(
        { error: "Failed to generate response." },
        { status: 500 },
      );
    }

    const readable = new ReadableStream({
      async start(controller) {
        let canStream = true;
        let raw = "";
        let lastEmitted = "";

        try {
          for await (const chunk of completionStream) {
            raw += chunk;

            const partial = safeParsePartialObject(raw);
            if (!partial) {
              continue;
            }

            const serialized = JSON.stringify(partial);

            if (serialized !== lastEmitted && canStream) {
              lastEmitted = serialized;
              canStream = safeEnqueue(
                controller,
                encoder.encode(`${serialized}\n`),
              );
            }
          }

          const finalValue = JSON.parse(raw);
          const finalSerialized = JSON.stringify(finalValue);

          if (finalSerialized !== lastEmitted && canStream) {
            canStream = safeEnqueue(
              controller,
              encoder.encode(`${finalSerialized}\n`),
            );
          }

          safeClose(controller);
        } catch (error) {
          await logServerEvent("warn", "api.generate.config.stream_failed", {
            requestId,
            error,
            streamedLength: lastEmitted.length,
          });

          if (!lastEmitted && canStream) {
            const fallback = JSON.stringify({
              error: "Failed to parse AI output.",
            });
            safeEnqueue(controller, encoder.encode(`${fallback}\n`));
          }

          safeClose(controller);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    await logServerEvent("error", "api.generate.config.failed", {
      requestId,
      error,
    });

    return NextResponse.json(
      { error: "Unable to process request." },
      { status: 500 },
    );
  }
}
