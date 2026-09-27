import OpenAI from "openai";
import { NextResponse } from "next/server";

import { IntakeChatMessage } from "@/types";

import {
  SERVERONLY_getConversationHistory,
  SERVERONLY_getStatementWithConfigFromToken,
} from "@/lib/supabase/queries";
import {
  SERVERONLY_mergeWitnessMetadata,
  SERVERONLY_saveConversationMessage,
  SERVERONLY_updateLatestAssistantConversationMeta,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import {
  generateChatSystemPrompt,
  generateIntakeStatePrompt,
} from "@/lib/llm/prompts";
import {
  buildKnownCaseFacts,
  loadCaseModelContext,
} from "@/lib/llm/case-runtime";
import {
  activeCaseFieldIds,
  formatEnquiryTranscript,
  mergeCaseFacts,
  readEnquiryTranscript,
  statedCaseDetails,
} from "@/lib/leads/case-facts";
import { getServiceClient } from "@/lib/supabase/server";

import { randomUUID } from "crypto";
import {
  CHAT_METADATA_MARKER,
  getLastMeta,
  preservePhaseHighWater,
} from "@/lib/statement-utils";
import { ResponseMetadataSchema } from "@/lib/schema";
import { enforcePersistentRateLimit } from "@/lib/api-utils/persistent-rate-limit";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { extractJsonStringField } from "@/lib/llm/json-content";
import {
  mergeWitnessDetailPatch,
  statedWitnessDetails,
} from "@/lib/llm/witness-details";
import { z } from "zod";
import { logServerEvent } from "@/lib/observability/logger";
import { zodTextFormat } from "openai/helpers/zod";
import { selectModel } from "@/lib/llm/model-config";
import { streamResponsesText } from "@/lib/llm/openai-responses";
import {
  getCloudflareAiClientOptions,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";
import {
  evaluateIntakeTurnWithJev,
  overlayJevControlMetadata,
} from "@/lib/llm/jev/interview-turn";
import {
  buildIntakeChatFileParts,
  type IntakeChatContentPart,
} from "@/lib/files";
import type { EvidenceDocument } from "@/lib/evidence";

const client = new OpenAI(getCloudflareAiClientOptions());

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

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim()) next[key] = entry;
  }
  return next;
}

async function recordStatedCaseFacts(params: {
  caseId: string;
  incoming: { [key: string]: string | null } | null | undefined;
  allowed: readonly string[];
}) {
  if (!params.incoming) return;
  const allowed = new Set(params.allowed);
  const stated: Record<string, string> = {};
  for (const [key, value] of Object.entries(params.incoming)) {
    if (!allowed.has(key) || typeof value !== "string" || !value.trim()) continue;
    stated[key] = value.trim();
  }
  if (!Object.keys(stated).length) return;

  const supabase = getServiceClient("intake-chat-case-facts");
  const { data, error } = await supabase
    .from("cases")
    .select("case_metadata")
    .eq("id", params.caseId)
    .maybeSingle();
  if (error || !data) return;
  const current = stringRecord(data.case_metadata);
  const next = mergeCaseFacts(current, stated);
  const changed = Object.entries(next).some(([key, value]) => current[key] !== value);
  if (!changed) return;
  const previous =
    data.case_metadata &&
    typeof data.case_metadata === "object" &&
    !Array.isArray(data.case_metadata)
      ? data.case_metadata
      : {};
  await supabase
    .from("cases")
    .update({ case_metadata: { ...previous, ...next } })
    .eq("id", params.caseId);
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

  if (!isCloudflareAiConfigured()) {
    await logServerEvent("error", "api.intake.chat.misconfigured", {
      requestId,
      reason: "missing_cloudflare_ai_credentials",
    });
    return NextResponse.json(
      { error: "Cloudflare AI is not configured." },
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

    const rate = await enforcePersistentRateLimit({
      request,
      scope: "intake-chat",
      identifier: token,
      limit: 30,
      windowSeconds: 60,
    });

    if (rate) {
      await logServerEvent("warn", "api.intake.chat.rate_limited", {
        requestId,
        key: `intake-chat:${token}`,
      });
      return rate;
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

    if (statement.lead_stage === "declined") {
      return NextResponse.json(
        {
          error:
            "The firm is not taking this any further. This chat has stopped.",
        },
        { status: 409 },
      );
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
        "This account has already been stopped. Please contact the law firm for next steps.",
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
    const priorEnquiry = formatEnquiryTranscript(
      readEnquiryTranscript(statement.qualification_answers),
    );

    const storedHistory = await SERVERONLY_getConversationHistory(statement.id);
    const scoreHistory: IntakeChatMessage[] = [
      ...storedHistory.flatMap((row) => {
        if (row.role !== "assistant" && row.role !== "user") return [];
        return [
          {
            role: row.role,
            content: row.content ?? "",
            meta: row.meta ?? undefined,
          },
        ];
      }),
      ...conversationHistory,
    ];
    const previousMetadata = preservePhaseHighWater(
      getLastMeta(scoreHistory, statementConfig),
      scoreHistory,
      statementConfig,
    );
    const jevDecisions = await evaluateIntakeTurnWithJev({
      previousMetadata,
      statementConfig,
      conversationHistory,
      userMessage: userMessageForLogging,
      attachedFileNames: [
        ...attachedFiles.map((file) => file.name),
        ...persistedAttachments.map((file) => file.name),
      ].filter((name) => name.trim().length > 0),
      priorEnquiry,
    });
    const lastMetadata = jevDecisions.metadata;
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
      jevUsed: jevDecisions.usedJev,
      jevTurnKind: jevDecisions.turnKind,
    });

    try {
      const witnessMetadata =
        statement.witness_metadata &&
        typeof statement.witness_metadata === "object" &&
        !Array.isArray(statement.witness_metadata)
          ? (statement.witness_metadata as Record<string, unknown>)
          : {};
      const caseContext = statement.case_id
        ? await loadCaseModelContext(
            getServiceClient("intake-chat"),
            statement.case_id,
          )
        : null;
      const chatSystemPrompt = await generateChatSystemPrompt(statementConfig, {
        witnessMetadata,
        matterBrief: caseContext?.matterBrief,
        priorEnquiry,
        caseFacts: buildKnownCaseFacts({
          caseConfig: caseContext?.caseConfig ?? null,
          caseMetadata: caseContext?.caseMetadata ?? null,
          dependencyIds: activeCaseFieldIds(statementConfig.caseMetadataDeps),
        }),
      });
      const transcript = modelMessages.flatMap((message) => {
        const content =
          typeof message.content === "string"
            ? message.content
            : message.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n\n");
        if (!content.trim()) {
          return [];
        }
        if (message.role !== "user" && message.role !== "assistant") {
          return [];
        }
        return [{ role: message.role, content }];
      });

      // Luna rejects a temperature parameter, so this call leaves it unset.
      responseStream = await streamResponsesText({
        client,
        model: selectedModel,
        instructions: chatSystemPrompt,
        promptCacheKey: statement.id,
        textFormat: zodTextFormat(responseSchema, "assistant_response"),
        input: [
          ...transcript,
          {
            role: "developer",
            content: generateIntakeStatePrompt(lastMetadata, jevDecisions),
          },
        ],
      });
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
            const nextContent = extractJsonStringField(rawResponse, "content");
            if (
              nextContent &&
              nextContent.length > streamedContent.length &&
              nextContent.startsWith(streamedContent)
            ) {
              const delta = nextContent.slice(streamedContent.length);
              streamedContent = nextContent;
              if (canStream) {
                canStream = safeEnqueue(controller, encoder.encode(delta));
              }
            }
          }

          assistantContent = streamedContent;

          try {
            const parsed = responseSchema.parse(JSON.parse(rawResponse));
            metadata = preservePhaseHighWater(
              jevDecisions.usedJev
                ? overlayJevControlMetadata(parsed.metadata, jevDecisions.metadata)
                : parsed.metadata,
              scoreHistory,
              statementConfig,
            );

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

          const witnessPatch = mergeWitnessDetailPatch(
            metadata.witnessDetails,
            statedWitnessDetails({
              userMessage: userMessageForLogging,
              fieldIds: (statementConfig.witnessMetadataFields ?? []).map(
                (field) => field.id,
              ),
              existing:
                statement.witness_metadata &&
                typeof statement.witness_metadata === "object" &&
                !Array.isArray(statement.witness_metadata)
                  ? (statement.witness_metadata as Record<string, string | null>)
                  : {},
            }),
          );
          if (Object.keys(witnessPatch).length > 0) {
            metadata.witnessDetails = {
              ...(metadata.witnessDetails ?? {}),
              ...witnessPatch,
            };
          }

          if (statement.case_id) {
            const allowed = activeCaseFieldIds(statementConfig.caseMetadataDeps);
            const stated = statedCaseDetails(userMessageForLogging, allowed);
            const current = metadata.caseDetails;
            const casePatch: Record<string, string | null> = {};
            let statedAny = false;
            for (const id of allowed) {
              const modelValue = current?.[id];
              const statedValue = stated[id];
              const value =
                typeof modelValue === "string" && modelValue.trim()
                  ? modelValue.trim()
                  : (statedValue ?? null);
              casePatch[id] = value;
              if (value) statedAny = true;
            }
            if (statedAny) metadata.caseDetails = casePatch;
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

            if (Object.keys(witnessPatch).length > 0) {
              await SERVERONLY_mergeWitnessMetadata(statement.id, witnessPatch);
            }

            await SERVERONLY_updateLatestAssistantConversationMeta(
              statement.id,
              metadata,
            );
            if (statement.case_id) {
              await recordStatedCaseFacts({
                caseId: statement.case_id,
                incoming: metadata.caseDetails,
                allowed: activeCaseFieldIds(statementConfig.caseMetadataDeps),
              });
            }
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
