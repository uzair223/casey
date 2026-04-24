import OpenAI from "openai";
import {
  downloadUploadedDocument,
  SERVERONLY_getConversationHistory,
  SERVERONLY_getStatementWithConfigFromToken,
} from "@/lib/supabase/queries";
import { generateFormalizeSystemPrompt } from "@/lib/statement-utils/prompts";
import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { Allow, parse as parsePartialJson } from "partial-json";
import { z } from "zod";
import { logServerEvent } from "@/lib/observability/logger";

import { env } from "@/lib/env";
import { getOpenRouterClientOptions } from "@/lib/utils";
import {
  createEvidenceExhibits,
  getEvidenceDocuments,
} from "@/lib/intake-evidence";
import { buildIntakeChatFileParts } from "@/lib/intake-chat-file-parts";

function previewText(value: string, maxLength = 800): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...[truncated]`;
}

const client = new OpenAI(getOpenRouterClientOptions());

function isRetriableError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { status?: number; code?: string; name?: string };
  return e.status === 429 || e.status === 502 || e.status === 503;
}

function isAbortError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { name?: string; code?: string };
  return e.name === "AbortError" || e.code === "ABORT_ERR";
}

function isStructuredParseOrValidationError(error: unknown) {
  if (error instanceof SyntaxError) return true;
  if (error instanceof z.ZodError) return true;
  return false;
}

function parseFormalizeContent(
  content: string,
  schema: z.ZodObject<Record<string, z.ZodString>>,
) {
  try {
    return schema.parse(JSON.parse(content));
  } catch (strictError) {
    // Some providers may still produce near-valid JSON despite json_schema mode.
    // Attempt a safe recovery parse, then validate strictly with Zod.
    try {
      const recovered = parsePartialJson(content, Allow.OBJ | Allow.STR);
      return schema.parse(recovered);
    } catch {
      throw strictError;
    }
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const { token } = await params;

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      await logServerEvent("warn", "api.intake.formalize.not_found", {
        requestId,
        tokenSuffix: token.slice(-6),
      });
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      await logServerEvent("warn", "api.intake.formalize.access_denied", {
        requestId,
        status: accessError.status,
      });
      return accessError;
    }

    if (
      statement.status === "locked" ||
      statement.status === "finalized" ||
      statement.status === "completed"
    ) {
      await logServerEvent("warn", "api.intake.formalize.precondition_failed", {
        requestId,
        reason: "statement_not_formalizable",
        statementId: statement.id,
      });
      return NextResponse.json(
        { error: "Unauthorized or locked." },
        { status: 409 },
      );
    }

    const statementConfig = statement.statement_config || {
      name: "Default",
      agents: { chat: "", formalize: "" },
      phases: [],
      sections: [],
      witness_metadata_fields: [],
      case_metadata_deps: [],
      prompts: {
        chat_system_template: null,
        formalize_system_template: null,
      },
    };

    const responses = await SERVERONLY_getConversationHistory(statement.id);

    const evidence = getEvidenceDocuments(statement.supporting_documents);
    const exhibits = createEvidenceExhibits(evidence, statement.witness_name);

    const evidenceFiles = await Promise.all(
      exhibits.flatMap((exhibit) =>
        exhibit.documents.map(async (document, index) => {
          const blob = await downloadUploadedDocument(document);

          const originalName =
            "name" in document && typeof document.name === "string"
              ? document.name
              : `document-${index + 1}`;

          return new File(
            [blob],
            `Exhibit ${exhibit.exhibit}.${index + 1} - ${originalName}`,
            {
              type: blob.type || "application/pdf",
            },
          );
        }),
      ),
    );

    const evidenceList = exhibits.length
      ? exhibits
          .map(
            (exhibit) => `Exhibit ${exhibit.exhibit}: ${exhibit.description}`,
          )
          .join("\n")
      : undefined;

    const evidenceInput = await buildIntakeChatFileParts({
      userMessage: "EVIDENCE EXHIBITS",
      files: evidenceFiles,
    });

    await logServerEvent("info", "api.intake.formalize.evidence_input", {
      requestId,
      attachedFiles: evidenceInput.attachedFiles,
      contentPreview:
        typeof evidenceInput.content === "string"
          ? previewText(evidenceInput.content)
          : evidenceInput.content
              .filter((part) => part.type === "text")
              .map((part) => previewText(part.text))
              .join("\n\n"),
    });

    await logServerEvent("info", "api.intake.formalize.request", {
      requestId,
      path: "/api/intake/[token]/interview/formalize",
      tokenSuffix: token.slice(-6),
      responseCount: responses.length,
      evidenceCount: (evidence ?? []).length,
    });

    const normalizedResponses = responses
      .map((response) => ({
        role: response.role,
        content: response.content.trim(),
      }))
      .filter((response) => !!response.content)
      .slice(-env.FORMALIZE_MAX_USER_TURNS)
      .map((response, index) => {
        const normalized = response.content.replace(/\s+/g, " ").trim();
        const bounded = normalized.slice(0, env.FORMALIZE_MAX_CHARS_PER_TURN);
        return `${index + 1}. ${response.role.toLocaleUpperCase()}:\n${bounded}\n\n`;
      });

    const transcriptText = normalizedResponses.length
      ? normalizedResponses.join("\n")
      : "No transcript available.";

    // Build strict structured output schema from configured section ids.
    const sectionEntries = Object.fromEntries(
      statementConfig.sections.map((section) => [section.id, z.string()]),
    );
    const formalizeSchema = z.object(sectionEntries).strict();
    const formalizeJsonSchema = {
      type: "object",
      properties: Object.fromEntries(
        statementConfig.sections.map((section) => [
          section.id,
          { type: "string" },
        ]),
      ),
      required: statementConfig.sections.map((section) => section.id),
      additionalProperties: false,
    } as const;

    let parsed: Record<string, string> | null = null;
    let lastError: unknown = null;

    await logServerEvent("info", "api.intake.formalize.model.call", {
      requestId,
      model: env.OPENROUTER_MODEL,
      maxAttempts: env.FORMALIZE_MAX_ATTEMPTS,
      timeoutMs: env.FORMALIZE_TIMEOUT_MS,
      transcriptLength: transcriptText.length,
    });

    for (let attempt = 1; attempt <= env.FORMALIZE_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        env.FORMALIZE_TIMEOUT_MS,
      );
      try {
        const completion = await client.chat.completions.create(
          {
            model: env.OPENROUTER_MODEL,
            messages: [
              {
                role: "system",
                content: generateFormalizeSystemPrompt(
                  statementConfig,
                  evidenceList,
                ),
              },
              {
                role: "user",
                // @ts-expect-error OpenRouter accepts multimodal message content here.
                content: evidenceInput.content,
              },
              {
                role: "user",
                content: `TRANSCRIPT:\n\n${transcriptText}`,
              },
            ],
            plugins: evidenceInput.requiresPdfPlugin
              ? [
                  {
                    id: "file-parser",
                    pdf: {
                      engine: "pdf-text",
                    },
                  },
                ]
              : undefined,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "witness_statement",
                strict: true,
                schema: formalizeJsonSchema,
              },
            },
          },
          { signal: controller.signal },
        );

        const content = completion.choices[0]?.message?.content?.trim();
        if (!content) {
          throw new Error("Empty AI response");
        }

        parsed = parseFormalizeContent(content, formalizeSchema);

        await logServerEvent("info", "api.intake.formalize.model.response", {
          requestId,
          model: env.OPENROUTER_MODEL,
          attempt,
          rawResponsePreview: previewText(content),
          rawResponseLength: content.length,
          parsed,
        });

        break;
      } catch (error) {
        lastError = error;

        await logServerEvent(
          "warn",
          "api.intake.formalize.model.attempt_failed",
          {
            requestId,
            model: env.OPENROUTER_MODEL,
            attempt,
            error,
          },
        );

        if (
          (!isRetriableError(error) &&
            !isStructuredParseOrValidationError(error)) ||
          attempt === env.FORMALIZE_MAX_ATTEMPTS
        ) {
          break;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!parsed) {
      if (isAbortError(lastError)) {
        await logServerEvent("warn", "api.intake.formalize.timed_out", {
          requestId,
          model: env.OPENROUTER_MODEL,
        });
        return NextResponse.json(
          { error: "Formalization timed out. Please try again." },
          { status: 504 },
        );
      }
      throw lastError ?? new Error("Failed to formalize statement");
    }

    await logServerEvent("info", "api.intake.formalize.response", {
      requestId,
      sectionCount: Object.keys(parsed).length,
      parsed,
    });

    return NextResponse.json(parsed);
  } catch (error) {
    await logServerEvent("error", "api.intake.formalize.failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to formalize statement" },
      { status: 500 },
    );
  }
}
