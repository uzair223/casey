import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

import { getServiceClient } from "@/lib/supabase/server";
import { logServerEvent } from "@/lib/observability/logger";
import { selectModel } from "@/lib/llm/model-config";
import {
  createModelRequestTimeout,
  getModelRequestError,
} from "@/lib/llm/request";
import { getStructuredResponseJson } from "@/lib/llm/responses";
import {
  extractDocumentContent,
  type UploadedDocument,
} from "@/lib/files";
import {
  getStatementSupportingDocumentsWithClient,
  getUploadedDocumentsFromSupportingRows,
} from "@/lib/supabase/queries/statement-supporting-documents";
import { getOpenRouterClientOptions } from "@/lib/utils";
import { createEvidenceExhibits } from "@/lib/evidence";
import type { EvidenceExhibit } from "@/lib/evidence";
import type { StatementConfig } from "@/types";
import { generateFormalizeSystemPrompt } from "@/lib/statement-utils";

const MAX_USER_TURNS = Number(process.env.FORMALIZE_MAX_USER_TURNS ?? 40);
const MAX_CHARS_PER_TURN = Number(
  process.env.FORMALIZE_MAX_CHARS_PER_TURN ?? 1200,
);
const FORMALIZE_TIMEOUT_MS = Number(process.env.FORMALIZE_TIMEOUT_MS ?? 60_000);

type EvidenceSummary = {
  name: string;
  type: string;
  handledAs: string;
  warning?: string;
};

function buildEvidenceList(exhibits: EvidenceExhibit[]) {
  if (!exhibits.length) {
    return "No confirmed evidence provided.";
  }

  return exhibits
    .map((exhibit) => `Exhibit ${exhibit.exhibit}: ${exhibit.description}`)
    .join("\n");
}

function buildFormalizeResponseSchema(config: StatementConfig) {
  return z.object(
    Object.fromEntries(
      config.sections.map((section) => [section.id, z.string()]),
    ),
  );
}

function normalizeFormalizedSections(
  value: unknown,
  config: StatementConfig,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Formalization output was not an object.");
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    config.sections.map((section) => [
      section.id,
      typeof record[section.id] === "string" ? record[section.id] : "",
    ]),
  ) as Record<string, string>;
}

async function buildEvidenceInputs(params: {
  supabase: ReturnType<typeof getServiceClient>;
  tenantId: string;
  documents: UploadedDocument[];
}) {
  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  const summaries: EvidenceSummary[] = [];

  for (const document of params.documents) {
    try {
      const bucketId = document.bucketId || params.tenantId;
      const { data, error } = await params.supabase.storage
        .from(bucketId)
        .download(document.path);

      if (error || !data) {
        throw error ?? new Error("Failed to download evidence document.");
      }

      const extracted = await extractDocumentContent(data, document);

      if (extracted.type === "image_url") {
        contentParts.push({
          type: "image_url",
          image_url: { url: extracted.url },
        });
        summaries.push({
          name: document.name,
          type: document.type,
          handledAs: "image",
        });
      } else if (extracted.type === "text") {
        contentParts.push({
          type: "text",
          text: `[File: ${document.name}]\n${extracted.text}`,
        });
        summaries.push({
          name: document.name,
          type: document.type,
          handledAs: "text",
        });
      } else {
        summaries.push({
          name: document.name,
          type: document.type,
          handledAs: "metadata_only",
          warning: extracted.warning,
        });
      }
    } catch {
      summaries.push({
        name: document.name,
        type: document.type,
        handledAs: "metadata_only",
        warning: "Evidence could not be downloaded or extracted.",
      });
    }
  }

  return { contentParts, summaries };
}

export async function processFormalizationJob(jobId: string) {
  const supabase = getServiceClient("statement-formalization-worker");

  const { data: job, error: jobError } = await supabase
    .from("ai_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    throw new Error("Job not found.");
  }

  if (job.status === "succeeded") {
    return { ok: true, status: job.status };
  }

  if (job.kind !== "statement_formalization") {
    throw new Error("Unsupported job kind.");
  }

  await supabase
    .from("ai_generation_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const { data: statement, error: statementError } = await supabase
      .from("statements")
      .select(
        "id, tenant_id, status, witness_name, supporting_documents, config_snapshot_id",
      )
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    if (statementError) throw statementError;
    if (!statement) throw new Error("Statement not found.");

    if (
      ["locked", "finalized", "completed", "demo_published"].includes(
        statement.status,
      )
    ) {
      throw new Error("Statement is not formalizable.");
    }

    if (!statement.config_snapshot_id) {
      throw new Error("Statement has no configuration snapshot.");
    }

    const { data: configSnapshot, error: configSnapshotError } = await supabase
      .from("statement_config_snapshots")
      .select("config_json")
      .eq("id", statement.config_snapshot_id)
      .maybeSingle();

    if (configSnapshotError) throw configSnapshotError;

    const config = (configSnapshot?.config_json ?? {
      sections: [],
      phases: [],
      prompts: { formalize_system_template: null },
    }) as StatementConfig;

    if (!config.sections.length) {
      throw new Error("Statement template has no sections.");
    }

    const { data: messages, error: messagesError } = await supabase
      .from("conversation_messages")
      .select("id, role, content, created_at")
      .eq("statement_id", statement.id)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    const sourceMessages = messages ?? [];
    const transcript =
      sourceMessages
        .map((message: { role: string; content: string }) => ({
          role: message.role,
          content: message.content.trim(),
        }))
        .filter((message) => !!message.content)
        .slice(-MAX_USER_TURNS)
        .map((message, index) => {
          const normalized = message.content.replace(/\s+/g, " ").trim();
          const bounded = normalized.slice(0, MAX_CHARS_PER_TURN);
          return `${index + 1}. ${message.role.toUpperCase()}:\n${bounded}\n\n`;
        })
        .join("\n") || "No transcript available.";

    const supportingDocumentRows = await getStatementSupportingDocumentsWithClient(
      supabase,
      statement.id,
    );
    const evidenceDocuments =
      getUploadedDocumentsFromSupportingRows(supportingDocumentRows);
    const exhibits = createEvidenceExhibits(
      evidenceDocuments,
      statement.witness_name || "Witness",
    );
    const evidenceInputs = await buildEvidenceInputs({
      supabase,
      tenantId: statement.tenant_id,
      documents: evidenceDocuments,
    });

    const evidenceOverview = evidenceInputs.summaries.length
      ? evidenceInputs.summaries
          .map((file, index) => {
            const warning = file.warning ? ` - ${file.warning}` : "";
            return `${index + 1}. ${file.name} (${file.type}, ${file.handledAs})${warning}`;
          })
          .join("\n")
      : "No evidence files attached.";

    const model = selectModel("formalize");
    const client = new OpenAI(getOpenRouterClientOptions());
    const modelTimeout = createModelRequestTimeout(
      FORMALIZE_TIMEOUT_MS,
      "Statement formalization model request",
    );

    await logServerEvent("info", "api.intake.formalize.model.call", {
      jobId,
      model,
      timeoutMs: FORMALIZE_TIMEOUT_MS,
      transcriptLength: transcript.length,
      evidenceCount: evidenceInputs.summaries.length,
    });

    let response: Awaited<ReturnType<typeof client.chat.completions.parse>>;
    try {
      response = await client.chat.completions.parse(
        {
          model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: generateFormalizeSystemPrompt(
                config,
                buildEvidenceList(exhibits),
              ),
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `EVIDENCE EXHIBITS\n\n${evidenceOverview}`,
                },
                ...evidenceInputs.contentParts,
              ],
            },
            {
              role: "user",
              content: `TRANSCRIPT:\n\n${transcript}`,
            },
          ],
          response_format: zodResponseFormat(
            buildFormalizeResponseSchema(config),
            "witness_statement",
          ),
        },
        { signal: modelTimeout.signal },
      );
    } catch (error) {
      throw getModelRequestError(
        error,
        "Statement formalization model request",
      );
    } finally {
      modelTimeout.clear();
    }

    const content = getStructuredResponseJson(response);
    const parsed = normalizeFormalizedSections(JSON.parse(content), config);

    const sourceMessageVersions = sourceMessages.map(
      (message: { id: string; created_at: string }) => ({
        messageId: message.id,
        createdAt: message.created_at,
      }),
    );

    const { data: formalizationSnapshot, error: formalizationSnapshotError } =
      await supabase
        .from("statement_formalization_snapshots")
        .insert({
          statement_id: statement.id,
          tenant_id: statement.tenant_id,
          created_by_user_id: job.requested_by_user_id,
          model,
          sections: parsed,
          source_message_ids: sourceMessages.map(
            (message: { id: string }) => message.id,
          ),
          source_message_versions: sourceMessageVersions,
          evidence_documents: evidenceDocuments,
        })
        .select("id")
        .single();

    if (formalizationSnapshotError) throw formalizationSnapshotError;

    await supabase
      .from("statements")
      .update({
        formalization_snapshot_id: formalizationSnapshot.id,
      })
      .eq("id", statement.id);

    await supabase
      .from("ai_generation_jobs")
      .update({
        status: "succeeded",
        formalization_snapshot_id: formalizationSnapshot.id,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);

    return { ok: true, status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await supabase
      .from("ai_generation_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", jobId);

    void logServerEvent("error", "api.intake.formalize.worker_failed", {
      jobId,
      error: message,
    });

    throw error;
  }
}
