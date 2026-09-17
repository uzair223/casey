import type { UploadedDocument } from "@/types";
import { generateDoc } from "@/lib/doc-gen";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";

export async function downloadStorageDocument(params: {
  supabase: ReturnType<typeof getServiceClient>;
  bucketId: string;
  path: string;
}) {
  const { data, error } = await params.supabase.storage
    .from(params.bucketId)
    .download(params.path);

  if (error || !data) {
    throw error ?? new Error("Failed to download storage document");
  }

  return new Uint8Array(await data.arrayBuffer());
}

export async function uploadStorageDocument(params: {
  supabase: ReturnType<typeof getServiceClient>;
  bucketId: string;
  path: string;
  file: Blob | Uint8Array;
  name: string;
  description?: string;
  contentType: string;
}) {
  const { data, error } = await params.supabase.storage
    .from(params.bucketId)
    .upload(params.path, params.file, {
      contentType: params.contentType,
      upsert: true,
    });

  if (error || !data) {
    throw error ?? new Error("Failed to upload storage document");
  }

  return {
    bucketId: params.bucketId,
    name: params.name,
    description: params.description,
    path: data.path,
    uploadedAt: new Date().toISOString(),
    type: params.contentType,
  } as UploadedDocument;
}

export function getStatementDocumentName(data: {
  case: { title: string };
  statement: { witness_name: string };
}) {
  return `${data.case.title || "case"} ${data.statement.witness_name} Witness Statement.docx`;
}

export async function renderUnsignedStatementDocument(params: {
  data: NonNullable<
    Awaited<ReturnType<typeof SERVERONLY_getFullStatementFromToken>>
  >;
  supabase: ReturnType<typeof getServiceClient>;
}) {
  const templateDocument = params.data.statement.template_document_snapshot
    ? await downloadStorageDocument({
        supabase: params.supabase,
        bucketId:
          params.data.statement.template_document_snapshot.bucketId ??
          params.data.tenant_id,
        path: params.data.statement.template_document_snapshot.path,
      })
    : null;

  return generateDoc(
    {
      caseMetadata:
        (params.data.case.case_metadata as Record<
          string,
          string | number | null | undefined
        >) ?? {},
      witnessName: params.data.statement.witness_name,
      witnessEmail: params.data.statement.witness_email,
      witnessMetadata:
        (params.data.statement.witness_metadata as Record<
          string,
          string | number | null | undefined
        >) ?? {},
      sections: params.data.statement.sections,
      config: params.data.statement.statement_config,
    },
    templateDocument,
  );
}

export async function getOrRenderUnsignedStatementBytes(params: {
  data: NonNullable<
    Awaited<ReturnType<typeof SERVERONLY_getFullStatementFromToken>>
  >;
  supabase: ReturnType<typeof getServiceClient>;
}) {
  const existingSignedDocument = params.data.statement.signed_document;
  if (existingSignedDocument?.path) {
    return downloadStorageDocument({
      supabase: params.supabase,
      bucketId: existingSignedDocument.bucketId ?? params.data.tenant_id,
      path: existingSignedDocument.path,
    });
  }

  const rendered = await renderUnsignedStatementDocument(params);
  return new Uint8Array(await rendered.arrayBuffer());
}
