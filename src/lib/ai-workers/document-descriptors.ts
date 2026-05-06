import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

import { extractDocumentContent } from "@/lib/files";
import { selectModel } from "@/lib/llm/model-config";
import {
  createModelRequestTimeout,
  getModelRequestError,
} from "@/lib/llm/request";
import { getStructuredResponseJson } from "@/lib/llm/responses";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_updateStatementSupportingDocumentDescriptors } from "@/lib/supabase/mutations/statement-supporting-documents";
import type {
  StatementDocumentDescriptors,
  StatementSupportingDocument,
} from "@/types";
import { getOpenRouterClientOptions } from "@/lib/utils";

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

    const extracted = await extractDocumentContent(data, document);
    const contentParts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text: `File name: ${document.name}
MIME type: ${document.type}
Evidence group: ${params.documentRow.group_name ?? document.group ?? "supporting evidence"}
Upload source: ${params.documentRow.uploaded_by_type}`,
      },
    ];

    if (extracted.type === "text") {
      contentParts.push({
        type: "text",
        text: `Extracted text:\n${extracted.text}`,
      });
    } else if (extracted.type === "image_url") {
      contentParts.push({
        type: "image_url",
        image_url: { url: extracted.url },
      });
    } else if (extracted.warning) {
      contentParts.push({
        type: "text",
        text: `Extraction note: ${extracted.warning}`,
      });
    }

    const model = selectModel("document-descriptor");
    const client = new OpenAI(getOpenRouterClientOptions());
    const modelTimeout = createModelRequestTimeout(
      DOCUMENT_DESCRIPTOR_TIMEOUT_MS,
      "Document descriptor model request",
    );

    let response: Awaited<ReturnType<typeof client.chat.completions.parse>>;
    try {
      response = await client.chat.completions.parse(
        {
          model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "Produce concise legal-document descriptors for a solicitor reviewing statement evidence. Stay neutral, do not infer facts beyond the supplied file, and keep each key detail short.",
            },
            {
              role: "user",
              content: contentParts,
            },
          ],
          response_format: zodResponseFormat(
            DocumentDescriptorSchema,
            "statement_document_descriptor",
          ),
        },
        { signal: modelTimeout.signal },
      );
    } catch (error) {
      throw getModelRequestError(error, "Document descriptor model request");
    } finally {
      modelTimeout.clear();
    }

    const descriptor = JSON.parse(
      getStructuredResponseJson(response),
    ) as StatementDocumentDescriptors;

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
