import type { UploadedDocument } from "@/types";
import { getServiceClient } from "@/lib/supabase/server";

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
