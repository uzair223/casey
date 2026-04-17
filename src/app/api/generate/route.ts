import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Allow, parse } from "partial-json";
import { z } from "zod";

import { requireUser } from "@/lib/api-utils/auth";
import { badRequest } from "@/lib/api-utils/response";
import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/observability/logger";
import { getOpenRouterClientOptions } from "@/lib/utils";

const client = new OpenAI(getOpenRouterClientOptions());

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
  seedData: z.object().optional(),
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

  if (!env.OPENROUTER_API_KEY) {
    await logServerEvent("error", "api.generate.misconfigured", {
      requestId,
      reason: "missing_openrouter_api_key",
    });
    return NextResponse.json(
      {
        error: "OpenRouter API key not configured.",
      },
      { status: 500 },
    );
  }

  try {
    const auth = await requireUser(request);
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
    const selectedModel = env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

    await logServerEvent("info", "api.generate.request", {
      requestId,
      model: selectedModel,
      userId: auth.userId,
      inputLength: input.length,
      conversationLength: conversationHistory.length,
    });

    let completionStream: AsyncIterable<string>;

    try {
      const completion = await client.chat.completions.create({
        model: selectedModel,
        temperature: 0.2,
        stream: true,
        response_format: responseFormat,
        messages: [
          {
            role: "system",
            content:
              "You are a strict JSON generator. Output only JSON that conforms to the provided schema. Treat seedData as the current draft state. Preserve all unrelated fields exactly as-is and make only the changes requested in the latest user turn. Do not regenerate unaffected sections unless the user explicitly asks.",
          },
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

      completionStream = (async function* () {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        }
      })();
    } catch (error) {
      await logServerEvent("error", "api.generate.model_call_failed", {
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
          await logServerEvent("warn", "api.generate.stream_failed", {
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

    await logServerEvent("error", "api.generate.failed", {
      requestId,
      error,
    });

    return NextResponse.json(
      { error: "Unable to process request." },
      { status: 500 },
    );
  }
}
