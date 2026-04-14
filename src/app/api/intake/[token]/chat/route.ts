import { OpenRouter } from "@openrouter/sdk";
import { NextResponse } from "next/server";

import { Message } from "@/types";

import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import {
  SERVERONLY_saveConversationMessage,
  SERVERONLY_updateLatestAssistantConversationMeta,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import {
  generateChatSystemPrompt,
  generateMetadataSystemPrompt,
} from "@/lib/statement-utils/prompts";

import { randomUUID } from "crypto";
import { CHAT_METADATA_MARKER, getLastMeta } from "@/lib/statement-utils";
import { ResponseMetadataSchema } from "@/lib/schema";
import { enforceRateLimit, getRateLimitKey } from "@/lib/api-utils/rate-limit";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { Allow, parse } from "partial-json";
import { z } from "zod";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { status?: number; code?: number };
  return e.status === 429 || e.code === 429;
}

function safeEnqueue(
  controller: ReadableStreamDefaultController,
  chunk: Uint8Array,
): boolean {
  try {
    controller.enqueue(chunk);
    return true;
  } catch (error) {
    const e = error as { code?: string };
    if (e?.code === "ERR_INVALID_STATE") {
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured." },
      {
        status: 500,
      },
    );
  }

  const requestId = randomUUID();
  const encoder = new TextEncoder();

  try {
    const { token } = await params;
    const body = await request.json();
    const { userMessage, conversationHistory } = body as {
      userMessage?: string;
      conversationHistory?: Message[];
    };

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json("userMessage is required.", { status: 400 });
    }

    if (!Array.isArray(conversationHistory)) {
      return NextResponse.json("conversationHistory must be an array.", {
        status: 400,
      });
    }

    const rate = enforceRateLimit({
      key: getRateLimitKey(request, `intake-chat:${token}`),
      limit: 30,
      windowMs: 60_000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        "Too many requests. Please wait and try again.",
        { status: 429 },
      );
    }

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      return NextResponse.json("Invalid or expired link.", { status: 404 });
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    if (!statement.gdpr_notice_acknowledgement) {
      return NextResponse.json(
        "Please review and accept the privacy notice before starting this intake.",
        { status: 409 },
      );
    }

    if (statement.status === "locked") {
      return NextResponse.json(
        "This witness statement intake has already been stopped. Please contact the law firm for next steps.",
        { status: 409 },
      );
    }

    const statementConfig = statement.statement_config;

    const lastMetadata = getLastMeta(conversationHistory, statementConfig);
    const transcript = conversationHistory
      .concat([{ role: "user", content: userMessage }])
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join("\n\n");

    const metadataSchema = ResponseMetadataSchema(statementConfig);
    const responseSchema = z
      .object({
        content: z.string().trim().min(1),
        metadata: metadataSchema,
      })
      .strict();

    let responseStream;
    try {
      responseStream = client
        .callModel({
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          instructions: `${generateChatSystemPrompt(statementConfig)}

${generateMetadataSystemPrompt(statementConfig)}

Coupling rules:
- Produce content and metadata for the SAME turn.
- metadata.progress.currentPhase must match the phase being asked about in content.
- Do not ask next-phase questions in content while current phase is not sufficiently complete.
- metadata.progress.phaseCompleteness must reflect the progression implied by content and latest user message.`,
          input: [
            {
              role: "user",
              content: `TRANSCRIPT\n\n${transcript}`,
            },
            {
              role: "user",
              content: `LATEST USER MESSAGE\n${userMessage}`,
            },
            {
              role: "user",
              content: `PREVIOUS METADATA\n${JSON.stringify(lastMetadata)}`,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "witness_statement_response",
              strict: true,
              schema: responseSchema.toJSONSchema(),
            },
          },
          temperature: 0.7,
        })
        .getTextStream();
    } catch (error) {
      console.error(`[${requestId}]`, error);
      if (isRateLimitError(error)) {
        return NextResponse.json(
          "AI service is experiencing high demand. Please try again shortly.",
          { status: 429 },
        );
      }
      return NextResponse.json(
        "I encountered an error processing your message. Please try again.",
        { status: 500 },
      );
    }

    let canStream = true;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let rawResponse = "";
          let streamedContent = "";
          let assistantContent = "";
          let metadata = lastMetadata;

          for await (const chunk of responseStream) {
            if (!chunk) continue;
            rawResponse += chunk;

            try {
              const partial = parse(rawResponse, Allow.OBJ | Allow.STR);
              const nextContent =
                partial && typeof partial.content === "string"
                  ? partial.content
                  : "";

              if (
                nextContent.length > streamedContent.length &&
                nextContent.startsWith(streamedContent)
              ) {
                const delta = nextContent.slice(streamedContent.length);
                streamedContent = nextContent;
                if (canStream) {
                  canStream = safeEnqueue(controller, encoder.encode(delta));
                }
              }
            } catch {
              // Ignore partial parse failures until more tokens arrive.
            }
          }

          assistantContent = streamedContent;

          try {
            const parsed = responseSchema.parse(JSON.parse(rawResponse));
            metadata = parsed.metadata;

            // Ensure persisted content exactly matches parsed schema content.
            if (parsed.content.startsWith(streamedContent)) {
              const remainder = parsed.content.slice(streamedContent.length);
              assistantContent = parsed.content;
              if (remainder && canStream) {
                canStream = safeEnqueue(controller, encoder.encode(remainder));
              }
            } else {
              // Parsed content diverged from partial stream; persist parsed text.
              assistantContent = parsed.content;
            }
          } catch (parseError) {
            console.error(
              `[${requestId}] Coupled response parse failed, using streamed fallback.`,
              parseError,
            );
            if (!assistantContent) {
              assistantContent =
                "I encountered an issue while processing that. Could you repeat that detail in one short sentence?";
              if (canStream) {
                canStream = safeEnqueue(
                  controller,
                  encoder.encode(assistantContent),
                );
              }
            }
          }

          if (canStream) {
            safeEnqueue(
              controller,
              encoder.encode(
                `${CHAT_METADATA_MARKER}${JSON.stringify(metadata)}`,
              ),
            );
          }

          try {
            await SERVERONLY_saveConversationMessage(
              statement.id,
              "user",
              userMessage,
            );
            await SERVERONLY_saveConversationMessage(
              statement.id,
              "assistant",
              assistantContent,
            );

            if (metadata.deviation?.stopIntake) {
              await SERVERONLY_updateStatementStatus(statement.id, "locked");
            } else {
              const nextStatus =
                statement.status === "demo" ||
                statement.status === "demo_published"
                  ? statement.status
                  : "in_progress";
              await SERVERONLY_updateStatementStatus(statement.id, nextStatus);
            }

            await SERVERONLY_updateLatestAssistantConversationMeta(
              statement.id,
              metadata,
            );
          } catch (persistError) {
            console.error(`[${requestId}] Persistence error`, persistError);
          }
        } catch (err) {
          console.error(`[${requestId}] Stream error`, err);
        } finally {
          safeClose(controller);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Fatal API error`, error);
    return NextResponse.json(
      "I encountered an error processing your message. Please try again.",
      { status: 500 },
    );
  }
}
