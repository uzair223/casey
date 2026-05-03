import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import { getServiceClient } from "@/lib/supabase/server";
import { logServerEvent } from "@/lib/observability/logger";
import { selectModel } from "@/lib/llm/model-config";
import {
  createModelRequestTimeout,
  getModelRequestError,
} from "@/lib/llm/request";
import { getStructuredResponseJson } from "@/lib/llm/responses";
import { extractDocumentContent } from "@/lib/files";
import {
  getStatementSupportingDocumentsWithClient,
  getUploadedDocumentsFromSupportingRows,
} from "@/lib/supabase/queries/statement-supporting-documents";
import { createEvidenceExhibits } from "@/lib/evidence";
import { getOpenRouterClientOptions } from "@/lib/utils";
import { normalizeCaseAnalysis } from "@/lib/case-analysis/normalize";
import { CaseAnalysisSchema } from "@/lib/schema/case-analysis";
import type { CaseAnalysis } from "@/lib/schema/case-analysis";
import type { StatementSupportingDocument, UploadedDocument } from "@/types";

const MAX_EVIDENCE_FILES_PER_CASE = 8;
const CASE_ANALYSIS_TIMEOUT_MS = Number(
  process.env.CASE_ANALYSIS_TIMEOUT_MS ?? 60_000,
);

type EvidenceContext = {
  statementId: string;
  witnessName: string;
  documentId: string;
  documentTitle: string;
  documentName: string;
  exhibitId: string;
  exhibitDescription: string;
  groupName: string | null;
  documentType: string;
  uploadedByType: string;
  uploadedByUserId: string | null;
  uploadedByWitnessName: string | null;
  uploadedByWitnessEmail: string | null;
  descriptorStatus: string;
  descriptorModel: string | null;
  descriptorGeneratedAt: string | null;
  descriptors: StatementSupportingDocument["descriptors"];
  handledAs: string;
  text: string | null;
  warning?: string;
};

function getDocumentKey(document: UploadedDocument) {
  return [document.path, document.name, document.uploadedAt].join("\u001f");
}

function buildDescriptorLines(
  descriptors: StatementSupportingDocument["descriptors"],
) {
  const lines = [
    descriptors.summary ? `descriptorSummary: ${descriptors.summary}` : null,
    descriptors.documentType
      ? `descriptorDocumentType: ${descriptors.documentType}`
      : null,
    descriptors.keyDetails?.length
      ? `descriptorKeyDetails: ${JSON.stringify(descriptors.keyDetails)}`
      : null,
    descriptors.concerns?.length
      ? `descriptorConcerns: ${JSON.stringify(descriptors.concerns)}`
      : null,
  ];

  return lines.filter(Boolean) as string[];
}

function getEvidenceContextSummary(item: EvidenceContext) {
  const lines = [
    `documentId: ${item.documentId}`,
    `title: ${item.documentTitle}`,
    `documentName: ${item.documentName}`,
    `exhibitId: ${item.exhibitId}`,
    `groupName: ${item.groupName ?? "other"}`,
    `documentType: ${item.documentType}`,
    `uploadedByType: ${item.uploadedByType}`,
    `descriptorStatus: ${item.descriptorStatus}`,
    ...buildDescriptorLines(item.descriptors),
  ];

  return lines.join("\n");
}

function stringifySections(sections: unknown): string {
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
    return "";
  }

  return Object.entries(sections)
    .map(([sectionId, value]) =>
      typeof value === "string"
        ? `Section ${sectionId}:\n${value.trim()}`
        : `Section ${sectionId}:\n${JSON.stringify(value)}`,
    )
    .filter((section) => section.trim().length > 0)
    .join("\n\n");
}

function getStatementSections(statement: {
  sections?: unknown;
  statement_formalization_snapshots?: { sections: unknown } | null;
}) {
  const snapshot = statement.statement_formalization_snapshots;
  return snapshot?.sections ?? statement.sections;
}

async function buildEvidenceContext(params: {
  supabase: ReturnType<typeof getServiceClient>;
  tenantId: string;
  statements: Array<{
    id: string;
    witness_name: string;
    supporting_documents: unknown;
    bucketId?: string;
  }>;
}) {
  const contexts: EvidenceContext[] = [];
  let processedCount = 0;

  for (const statement of params.statements) {
    const supportingDocumentRows =
      await getStatementSupportingDocumentsWithClient(
        params.supabase,
        statement.id,
      );
    const documents = getUploadedDocumentsFromSupportingRows(
      supportingDocumentRows,
    );
    const rowsByDocumentKey = new Map(
      supportingDocumentRows.map((row) => [getDocumentKey(row.document), row]),
    );
    const exhibits = createEvidenceExhibits(
      documents,
      statement.witness_name || "Witness",
    );

    for (const exhibit of exhibits) {
      for (const document of exhibit.documents) {
        if (processedCount >= MAX_EVIDENCE_FILES_PER_CASE) {
          return contexts;
        }

        processedCount += 1;
        const supportingRow = rowsByDocumentKey.get(getDocumentKey(document));

        if (!supportingRow) {
          continue;
        }

        const baseContext = {
          statementId: statement.id,
          witnessName: statement.witness_name,
          documentId: supportingRow.id,
          documentTitle: supportingRow.title,
          documentName: document.name,
          exhibitId: exhibit.exhibit,
          exhibitDescription: exhibit.description,
          groupName: supportingRow.group_name,
          documentType: document.type,
          uploadedByType: supportingRow.uploaded_by_type,
          uploadedByUserId: supportingRow.uploaded_by_user_id,
          uploadedByWitnessName: supportingRow.uploaded_by_witness_name,
          uploadedByWitnessEmail: supportingRow.uploaded_by_witness_email,
          descriptorStatus: supportingRow.descriptor_status,
          descriptorModel: supportingRow.descriptor_model,
          descriptorGeneratedAt: supportingRow.descriptor_generated_at,
          descriptors: supportingRow.descriptors,
        };

        try {
          const bucketId = document.bucketId || params.tenantId;
          const { data, error } = await params.supabase.storage
            .from(bucketId)
            .download(document.path);

          if (error || !data) {
            throw error ?? new Error("Failed to download evidence document.");
          }

          const extracted = await extractDocumentContent(data, document);

          if (extracted.type === "text") {
            contexts.push({
              ...baseContext,
              handledAs: "text",
              text: extracted.text,
            });
          } else if (extracted.type === "image_url") {
            contexts.push({
              ...baseContext,
              handledAs: "metadata_only",
              text: null,
            });
          } else {
            contexts.push({
              ...baseContext,
              handledAs: "metadata_only",
              text: null,
              warning: extracted.warning,
            });
          }
        } catch {
          contexts.push({
            ...baseContext,
            handledAs: "metadata_only",
            text: null,
            warning: "Evidence could not be downloaded or extracted.",
          });
        }
      }
    }
  }

  return contexts;
}

export function buildEvidenceCorpus(contexts: EvidenceContext[]) {
  if (!contexts.length) {
    return "No supporting evidence files were available for inline analysis.";
  }

  return contexts
    .map((item, index) => {
      const metadata = [
        `EVIDENCE ${index + 1}`,
        `statementId: ${item.statementId}`,
        `witnessName: ${item.witnessName}`,
        `documentId: ${item.documentId}`,
        `documentTitle: ${item.documentTitle}`,
        `exhibitId: ${item.exhibitId}`,
        `exhibitDescription: ${item.exhibitDescription}`,
        `groupName: ${item.groupName ?? "other"}`,
        `documentName: ${item.documentName}`,
        `documentType: ${item.documentType}`,
        `uploadedByType: ${item.uploadedByType}`,
        item.uploadedByUserId
          ? `uploadedByUserId: ${item.uploadedByUserId}`
          : null,
        item.uploadedByWitnessName
          ? `uploadedByWitnessName: ${item.uploadedByWitnessName}`
          : null,
        item.uploadedByWitnessEmail
          ? `uploadedByWitnessEmail: ${item.uploadedByWitnessEmail}`
          : null,
        `descriptorStatus: ${item.descriptorStatus}`,
        item.descriptorModel ? `descriptorModel: ${item.descriptorModel}` : null,
        item.descriptorGeneratedAt
          ? `descriptorGeneratedAt: ${item.descriptorGeneratedAt}`
          : null,
        ...buildDescriptorLines(item.descriptors),
        `handledAs: ${item.handledAs}`,
        item.warning ? `warning: ${item.warning}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return `${metadata}\n\n${
        item.text
          ? `Extracted text:\n${item.text}`
          : item.documentType.startsWith("image/")
            ? "Uploaded photograph. Visual content is intentionally omitted from inline model context; use only the filename, exhibit number, descriptor fields, and metadata above."
            : "No extracted text available; use descriptor fields and metadata only."
      }`;
    })
    .join("\n\n---\n\n");
}

type StatementForAnalysis = {
  id: string;
  title: string;
  witness_name: string;
  witness_email: string;
  witness_metadata: unknown;
  status: string;
  sections: unknown;
  supporting_documents: unknown;
  updated_at: string;
  statement_formalization_snapshots?: { sections: unknown } | null;
};

function hasStatementContent(statement: StatementForAnalysis) {
  return stringifySections(getStatementSections(statement)).trim().length > 0;
}

function buildStatementCorpus(
  statements: StatementForAnalysis[],
  evidenceContexts: EvidenceContext[] = [],
) {
  const documentsByStatement = new Map<string, EvidenceContext[]>();
  for (const item of evidenceContexts) {
    documentsByStatement.set(item.statementId, [
      ...(documentsByStatement.get(item.statementId) ?? []),
      item,
    ]);
  }

  return statements
    .map((statement, index) => {
      const witnessMetadata =
        statement.witness_metadata &&
        typeof statement.witness_metadata === "object"
          ? JSON.stringify(statement.witness_metadata)
          : "{}";
      const supportingDocuments = documentsByStatement.get(statement.id) ?? [];
      const supportingDocumentIndex = supportingDocuments.length
        ? supportingDocuments
            .map((item, documentIndex) => {
              return `SUPPORTING DOCUMENT ${documentIndex + 1}
${getEvidenceContextSummary(item)}`;
            })
            .join("\n\n")
        : "No resolved supporting documents.";

      return `STATEMENT ${index + 1}
statementId: ${statement.id}
witnessName: ${statement.witness_name}
title: ${statement.title}
status: ${statement.status}
updatedAt: ${statement.updated_at}
witnessMetadata: ${witnessMetadata}
supportingDocuments:
${supportingDocumentIndex}

${stringifySections(getStatementSections(statement))}`;
    })
    .join("\n\n---\n\n");
}

const CASE_ANALYSIS_SYSTEM_PROMPT = `You analyse multiple witness statements and supporting evidence for a legal team.

Core rules:
- Stay neutral. Do not decide what truly happened, who is credible, who is liable, or what is proven.
- Only describe what the supplied statements and supporting evidence say.
- Every factual item must cite source material. Do not cite the same statement more than once for the same factual item.
- A fact belongs in agreedFacts only when supported by two or more distinct witness statements. A witness statement plus one document is corroboration, not an agreed fact.

Classify issues carefully:
- disputedFacts is for material inconsistencies, contradictions, or unresolved tensions.
- Include statement-vs-statement conflicts, statement-vs-evidence conflicts, and internal inconsistencies within a single document or statement.
- If evidence text conflicts with a witness narrative, add it to disputedFacts with separate positions for each account.
- If the same inconsistency needs clarification, include it in missingInformation too. Do not hide conflicts only in missingInformation.
- chronology.conflicts should briefly flag conflicts attached to timeline events.

Evidence handling:
- Supporting evidence may include extracted text or metadata-only uploads.
- Supporting evidence may include AI-generated descriptor fields: descriptorSummary, descriptorDocumentType, descriptorKeyDetails, and descriptorConcerns.
- Treat generated descriptor fields as document-reading assistance, not as independent witness testimony.
- Use descriptor fields for evidenceMentioned, chronology context, themes, gaps, and conflicts where relevant, especially for metadata_only documents.
- metadata_only files, especially images, are intentionally supplied as metadata to save tokens. Treat them as uploaded/available evidence.
- Do not describe metadata_only images as "not visible", "not supplied", "cannot be reviewed", or "cannot be described from the material provided".
- Do not create gaps, weaknesses, or suggested follow-ups merely because an uploaded image is metadata_only.
- Do not suggest "review the images directly" unless another textual source specifically says the image contents resolve a named issue.
- If a photograph is metadata_only, you may mention only that the photograph was uploaded/available and cite its filename or exhibit number.
- When evidence text is supplied, use it as supporting context and mention the document name in evidenceMentioned.
- When citing evidence in a source, use the associated statementId and witnessName, set sectionId to "evidence:<documentName>", set evidenceName to the documentName, and set exhibitId to the supplied exhibitId.
- When citing a witness statement rather than evidence, omit evidenceName and exhibitId.

Output style:
- Use "says", "states", "records", "appears", and "is inconsistent with"; avoid definitive findings.
- Keep suggested follow-ups concrete and proportionate.`;

export async function processCaseAnalysisJob(jobId: string) {
  const supabase = getServiceClient("case-analysis-worker");

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

  if (job.kind !== "case_analysis") {
    throw new Error("Unsupported job kind.");
  }

  await supabase
    .from("ai_generation_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const { data: caseRecord, error: caseError } = await supabase
      .from("cases")
      .select("id, tenant_id, title, case_metadata")
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    if (caseError) throw caseError;
    if (!caseRecord) throw new Error("Case not found.");

    const { data: statements, error: statementsError } = await supabase
      .from("statements")
      .select(
        "id, title, witness_name, witness_email, witness_metadata, status, supporting_documents, updated_at, statement_formalization_snapshots!statements_formalization_snapshot_id_fkey(sections)",
      )
      .eq("case_id", job.target_id)
      .eq("tenant_id", job.tenant_id)
      .order("created_at", { ascending: true });

    if (statementsError) throw statementsError;

    const sourceStatements = (
      (statements ?? []) as StatementForAnalysis[]
    ).filter(hasStatementContent);

    if (!sourceStatements.length) {
      throw new Error("No witness statement content is available to analyse.");
    }

    const evidenceContexts = await buildEvidenceContext({
      supabase,
      tenantId: job.tenant_id,
      statements: sourceStatements,
    });
    const evidenceCorpus = buildEvidenceCorpus(evidenceContexts);

    const model = selectModel("case-analysis");
    const client = new OpenAI(getOpenRouterClientOptions());
    const modelTimeout = createModelRequestTimeout(
      CASE_ANALYSIS_TIMEOUT_MS,
      "Case analysis model request",
    );

    await logServerEvent("info", "api.case_analysis.model.call", {
      jobId,
      model,
      timeoutMs: CASE_ANALYSIS_TIMEOUT_MS,
      statementCount: sourceStatements.length,
      evidenceCount: evidenceContexts.length,
      statementCorpusLength: buildStatementCorpus(
        sourceStatements,
        evidenceContexts,
      ).length,
      evidenceCorpusLength: evidenceCorpus.length,
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
              content: CASE_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Case title: ${caseRecord.title}
Case metadata: ${JSON.stringify(caseRecord.case_metadata ?? {})}

Witness statements:

${buildStatementCorpus(sourceStatements, evidenceContexts)}

Supporting evidence:

${evidenceCorpus}`,
            },
          ],
          response_format: zodResponseFormat(
            CaseAnalysisSchema,
            "case_analysis",
          ),
        },
        { signal: modelTimeout.signal },
      );
    } catch (error) {
      throw getModelRequestError(error, "Case analysis model request");
    } finally {
      modelTimeout.clear();
    }

    const content = getStructuredResponseJson(response);
    const analysis = normalizeCaseAnalysis(JSON.parse(content) as CaseAnalysis);
    const sourceStatementVersions = sourceStatements.map((statement) => ({
      statementId: statement.id,
      updatedAt: statement.updated_at,
    }));

    const { data: snapshot, error: insertError } = await supabase
      .from("case_analysis_snapshots")
      .insert({
        case_id: job.target_id,
        tenant_id: job.tenant_id,
        created_by_user_id: job.requested_by_user_id,
        model,
        analysis,
        source_statement_ids: sourceStatements.map((statement) => statement.id),
        source_statement_versions: sourceStatementVersions,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    await supabase
      .from("ai_generation_jobs")
      .update({
        status: "succeeded",
        result_snapshot_id: snapshot.id,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);

    return {
      ok: true,
      status: "succeeded",
      snapshotId: snapshot.id,
    };
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

    logServerEvent("error", "api.case_analysis.worker_failed", {
      jobId,
      error: message,
    });

    throw error;
  }
}
