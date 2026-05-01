import { env } from "@/lib/env";
import OpenAI from "openai";
import { NextResponse } from "next/server";

import { IntakeChatMessage } from "@/types";

import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import {
  SERVERONLY_saveConversationMessage,
  SERVERONLY_updateLatestAssistantConversationMeta,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import {
  generateChatSystemPrompt,
  generateIntakeStatePrompt,
} from "@/lib/llm/prompts";

import { randomUUID } from "crypto";
import { CHAT_METADATA_MARKER, getLastMeta } from "@/lib/statement-utils";
import { ResponseMetadataSchema } from "@/lib/schema";
import { enforceRateLimit, getRateLimitKey } from "@/lib/api-utils/rate-limit";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { Allow, parse } from "partial-json";
import { z } from "zod";
import { logServerEvent } from "@/lib/observability/logger";
import { zodResponseFormat } from "openai/helpers/zod";
import { selectModel } from "@/lib/llm/model-config";
import { getOpenRouterClientOptions } from "@/lib/utils";
import {
  buildIntakeChatFileParts,
  type IntakeChatContentPart,
} from "@/lib/files";
import type { EvidenceDocument } from "@/lib/evidence";

const client = new OpenAI(getOpenRouterClientOptions());

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

function previewText(value: string, maxLength = 800): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...[truncated]`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  if (!env.OPENROUTER_API_KEY) {
    await logServerEvent("error", "api.intake.chat.misconfigured", {
      requestId,
      reason: "missing_openrouter_api_key",
    });
    return NextResponse.json(
      { error: "OpenRouter API key not configured." },
      {
        status: 500,
      },
    );
  }

  const encoder = new TextEncoder();

  try {
    const { token } = await params;
    const contentType = request.headers.get("content-type") || "";

    let userMessage = "";
    let conversationHistory: IntakeChatMessage[] = [];
    const pendingUploads: File[] = [];
    let persistedAttachments: EvidenceDocument[] = [];

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      const parsedUserMessage = formData.get("userMessage");
      const parsedConversationHistory = formData.get("conversationHistory");
      const parsedPersistedAttachments = formData.get("persistedAttachments");

      userMessage =
        typeof parsedUserMessage === "string" ? parsedUserMessage.trim() : "";

      if (
        typeof parsedConversationHistory !== "string" ||
        !parsedConversationHistory
      ) {
        await logServerEvent("warn", "api.intake.chat.bad_request", {
          requestId,
          reason: "invalid_conversation_history_formdata",
        });
        return NextResponse.json("conversationHistory must be provided.", {
          status: 400,
        });
      }

      try {
        const parsed = JSON.parse(parsedConversationHistory) as unknown;
        if (!Array.isArray(parsed)) {
          throw new Error("conversationHistory must be an array.");
        }
        conversationHistory = parsed as IntakeChatMessage[];
      } catch {
        await logServerEvent("warn", "api.intake.chat.bad_request", {
          requestId,
          reason: "conversation_history_json_parse_failed",
        });
        return NextResponse.json("conversationHistory must be valid JSON.", {
          status: 400,
        });
      }

      if (typeof parsedPersistedAttachments === "string") {
        try {
          const parsed = JSON.parse(parsedPersistedAttachments) as unknown;
          if (Array.isArray(parsed)) {
            persistedAttachments = parsed as EvidenceDocument[];
          }
        } catch {
          persistedAttachments = [];
        }
      }

      const fileEntries = Array.from(formData.entries()).filter(([key]) =>
        key.startsWith("file_"),
      );

      fileEntries.forEach(([, fileData]) => {
        if (fileData instanceof File) {
          pendingUploads.push(fileData);
        }
      });
    } else {
      const body = await request.json();
      const parsedBody = body as {
        userMessage?: string;
        conversationHistory?: IntakeChatMessage[];
      };

      userMessage =
        typeof parsedBody.userMessage === "string"
          ? parsedBody.userMessage.trim()
          : "";
      conversationHistory = parsedBody.conversationHistory ?? [];
    }

    if (!Array.isArray(conversationHistory)) {
      await logServerEvent("warn", "api.intake.chat.bad_request", {
        requestId,
        reason: "invalid_conversation_history",
      });
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
      await logServerEvent("warn", "api.intake.chat.rate_limited", {
        requestId,
        key: `intake-chat:${token}`,
      });
      return NextResponse.json(
        "Too many requests. Please wait and try again.",
        { status: 429 },
      );
    }

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      await logServerEvent("warn", "api.intake.chat.not_found", {
        requestId,
        tokenSuffix: token.slice(-6),
      });
      return NextResponse.json("Invalid or expired link.", { status: 404 });
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      await logServerEvent("warn", "api.intake.chat.access_denied", {
        requestId,
        status: accessError.status,
      });
      return accessError;
    }

    if (!statement.gdpr_notice_acknowledgement) {
      await logServerEvent("warn", "api.intake.chat.precondition_failed", {
        requestId,
        reason: "gdpr_notice_not_acknowledged",
        statementId: statement.id,
      });
      return NextResponse.json(
        "Please review and accept the privacy notice before starting this intake.",
        { status: 409 },
      );
    }

    if (statement.status === "locked") {
      await logServerEvent("warn", "api.intake.chat.precondition_failed", {
        requestId,
        reason: "statement_locked",
        statementId: statement.id,
      });
      return NextResponse.json(
        "This witness statement intake has already been stopped. Please contact the law firm for next steps.",
        { status: 409 },
      );
    }

    if (!userMessage && pendingUploads.length === 0) {
      await logServerEvent("warn", "api.intake.chat.bad_request", {
        requestId,
        reason: "missing_user_message_and_uploads",
      });
      return NextResponse.json(
        "Please provide a message or attach at least one file.",
        { status: 400 },
      );
    }

    const userInput = await buildIntakeChatFileParts({
      userMessage,
      files: pendingUploads,
    });
    const attachedFiles = userInput.attachedFiles;
    const userMessageForLogging =
      typeof userInput.content === "string"
        ? userInput.content
        : userInput.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n\n");

    await logServerEvent("info", "api.intake.chat.request", {
      requestId,
      path: "/api/intake/[token]/interview/chat",
      tokenSuffix: token.slice(-6),
      userMessagePreview: previewText(userMessageForLogging),
      userMessageLength: userMessageForLogging.length,
      conversationHistoryLength: conversationHistory.length,
      uploadedDocumentCount: attachedFiles.length,
      uploadedDocumentModes: attachedFiles.map((file) => file.handledAs),
    });

    const statementConfig = statement.statement_config;

    const lastMetadata = getLastMeta(conversationHistory, statementConfig);
    const modelMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string | IntakeChatContentPart[];
    }> = [
      ...conversationHistory.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: "user", content: userInput.content },
    ];
    const contextCharLength = modelMessages.reduce(
      (total, message) =>
        total +
        (typeof message.content === "string"
          ? message.content.length
          : message.content
              .filter((part) => part.type === "text")
              .reduce((sum, part) => sum + part.text.length, 0)),
      0,
    );

    const metadataSchema = ResponseMetadataSchema(statementConfig);
    const responseSchema = z
      .object({
        content: z.string().trim().min(1),
        metadata: metadataSchema,
      })
      .strict();

    let responseStream: AsyncIterable<string>;
    const selectedModel = selectModel("intake-chat");

    await logServerEvent("info", "api.intake.chat.model.call", {
      requestId,
      model: selectedModel,
      transcriptLength: contextCharLength,
      temperature: 0.7,
    });

    try {
      const completion = await client.chat.completions.create({
        model: selectedModel,

        temperature: 0.3,

        response_format: zodResponseFormat(
          responseSchema,
          "assistant_response",
        ),

        messages: [
          {
            role: "system",
            content: generateChatSystemPrompt(statementConfig),
          },
          {
            role: "system",
            content: generateIntakeStatePrompt(lastMetadata),
          },
          // @ts-expect-error OpenRouter accepts multimodal message content here.
          ...modelMessages,
        ],
        plugins: userInput.requiresPdfPlugin
          ? [
              {
                id: "file-parser",
                pdf: {
                  engine: "pdf-text",
                },
              },
            ]
          : undefined,

        stream: true,
      });

      responseStream = (async function* () {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        }
      })();
    } catch (error) {
      await logServerEvent("error", "api.intake.chat.model.call.failed", {
        requestId,
        model: selectedModel,
        error,
      });
      if (isRateLimitError(error)) {
        await logServerEvent("warn", "api.intake.chat.model.rate_limited", {
          requestId,
          model: selectedModel,
        });
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
            await logServerEvent(
              "warn",
              "api.intake.chat.model.parse_fallback",
              {
                requestId,
                error: parseError,
                rawResponsePreview: previewText(rawResponse),
                streamedContentPreview: previewText(streamedContent),
              },
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

          await logServerEvent("info", "api.intake.chat.model.response", {
            requestId,
            assistantContentPreview: previewText(assistantContent),
            assistantContentLength: assistantContent.length,
            rawResponseLength: rawResponse.length,
            metadata,
          });

          if (canStream) {
            safeEnqueue(
              controller,
              encoder.encode(
                `${CHAT_METADATA_MARKER}${JSON.stringify(metadata)}`,
              ),
            );
          }

          try {
            const persistedUserMessage =
              userMessage ||
              (attachedFiles.length > 0 ? "Uploaded supporting files." : "");

            await SERVERONLY_saveConversationMessage(
              statement.id,
              "user",
              persistedUserMessage,
              {
                attachedFiles:
                  persistedAttachments.length > 0
                    ? persistedAttachments
                    : attachedFiles.length > 0
                      ? attachedFiles
                      : undefined,
                submittedAt: new Date().toISOString(),
              },
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
            await logServerEvent(
              "error",
              "api.intake.chat.persistence.failed",
              {
                requestId,
                statementId: statement.id,
                error: persistError,
              },
            );
          }
        } catch (err) {
          await logServerEvent("error", "api.intake.chat.stream.failed", {
            requestId,
            error: err,
          });
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
    await logServerEvent("error", "api.intake.chat.failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      "I encountered an error processing your message. Please try again.",
      { status: 500 },
    );
  }
}
