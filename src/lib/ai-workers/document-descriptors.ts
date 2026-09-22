import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";

import { selectDocumentDescriptorModel } from "@/lib/llm/model-config";
import {
  createModelRequestTimeout,
  getModelRequestError,
} from "@/lib/llm/request";
import {
  isMediaEvidenceKind,
  loadEvidenceFile,
} from "@/lib/llm/evidence-files";
import { collectResponsesText } from "@/lib/llm/openai-responses";
import { parseStructuredJson } from "@/lib/llm/responses";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_updateStatementSupportingDocumentDescriptors } from "@/lib/supabase/mutations/statement-supporting-documents";
import type {
  StatementDocumentDescriptors,
  StatementSupportingDocument,
} from "@/types";
import { getCloudflareAiClientOptions } from "@/lib/llm/cloudflare";

const DOCUMENT_DESCRIPTOR_TIMEOUT_MS = Number(
  process.env.DOCUMENT_DESCRIPTOR_TIMEOUT_MS ?? 30_000,
);

const DocumentDescriptorSchema = z.object({
  summary: z.string(),
  documentType: z.string(),
  keyDetails: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
});

export async function generateStatementDocumentDescriptor(params: {
  tenantId: string;
  documentRow: StatementSupportingDocument;
}): Promise<StatementDocumentDescriptors> {
  const supabase = getServiceClient("document-descriptor-worker");
  const document = params.documentRow.document;
  const bucketId = document.bucketId || params.tenantId;

  await SERVERONLY_updateStatementSupportingDocumentDescriptors({
    documentId: params.documentRow.id,
    status: "generating",
  });

  try {
    const { data, error } = await supabase.storage
      .from(bucketId)
      .download(document.path);

    if (error || !data) {
      throw error ?? new Error("Failed to download supporting document.");
    }

    const loaded = await loadEvidenceFile(data, document);
    const fileLabel = `File name: ${document.name}
MIME type: ${document.type}
Evidence group: ${params.documentRow.group_name ?? document.group ?? "supporting evidence"}
Upload source: ${params.documentRow.uploaded_by_type}`;
    const model = selectDocumentDescriptorModel(
      loaded.part && isMediaEvidenceKind(loaded.handledAs) ? "media" : "text",
    );
    const client = new OpenAI(getCloudflareAiClientOptions());
    const modelTimeout = createModelRequestTimeout(
      DOCUMENT_DESCRIPTOR_TIMEOUT_MS,
      "Document descriptor model request",
    );
    const descriptorInstructions =
      "Produce concise legal-document descriptors for a solicitor reviewing statement evidence. Stay neutral, do not infer facts beyond the supplied file, and keep each key detail short.";

    let descriptorJson: unknown;
    try {
      if (loaded.part && isMediaEvidenceKind(loaded.handledAs)) {
        const response = await client.chat.completions.parse(
          {
            model,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content: descriptorInstructions,
              },
              {
                role: "user",
                content: [
                  { type: "text", text: fileLabel },
                  loaded.part,
                ],
              },
            ],
            response_format: zodResponseFormat(
              DocumentDescriptorSchema,
              "statement_document_descriptor",
            ),
          },
          { signal: modelTimeout.signal },
        );
        descriptorJson = parseStructuredJson(
          response,
          "statement_document_descriptor",
        );
      } else {
        const textSections = [fileLabel];
        if (loaded.text) {
          textSections.push(`Extracted text:\n${loaded.text}`);
        } else if (loaded.warning) {
          textSections.push(`Extraction note: ${loaded.warning}`);
        }
        const generated = await collectResponsesText({
          client,
          model,
          temperature: 0.1,
          signal: modelTimeout.signal,
          instructions: descriptorInstructions,
          textFormat: zodTextFormat(
            DocumentDescriptorSchema,
            "statement_document_descriptor",
          ),
          input: [
            {
              role: "user",
              content: textSections.join("\n\n"),
            },
          ],
        });
        descriptorJson = JSON.parse(generated);
      }
    } catch (error) {
      throw getModelRequestError(error, "Document descriptor model request");
    } finally {
      modelTimeout.clear();
    }

    const descriptor = DocumentDescriptorSchema.parse(descriptorJson);

    await SERVERONLY_updateStatementSupportingDocumentDescriptors({
      documentId: params.documentRow.id,
      status: "generated",
      descriptors: descriptor,
      model,
    });

    return descriptor;
  } catch (error) {
    await SERVERONLY_updateStatementSupportingDocumentDescriptors({
      documentId: params.documentRow.id,
      status: "failed",
      descriptors: {
        summary:
          error instanceof Error
            ? `Descriptor generation failed: ${error.message}`
            : "Descriptor generation failed.",
      },
    });
    throw error;
  }
}

export async function generateMissingStatementDocumentDescriptors(params: {
  tenantId: string;
  documents: StatementSupportingDocument[];
  source?: "witness" | "internal_user";
}) {
  const rows = params.documents.filter(
    (row) =>
      (!params.source || row.uploaded_by_type === params.source) &&
      row.descriptor_status !== "generated",
  );

  for (const row of rows) {
    try {
      await generateStatementDocumentDescriptor({
        tenantId: params.tenantId,
        documentRow: row,
      });
    } catch {
      // Descriptors are helpful metadata, not a blocker for statement submission.
    }
  }
}
