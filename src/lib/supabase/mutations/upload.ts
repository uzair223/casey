import { UploadedDocument } from "@/types";
import { getSupabaseClient } from "../client";

type UploadPayload = {
  bucketId: string;
  name: string;
  path: string;
  file: File | Blob;
  contentType: string;
  description?: string;
  upsert?: boolean;
};

export const uploadFile = async ({
  bucketId,
  name,
  path,
  file,
  contentType,
  description,
  upsert = false,
}: UploadPayload): Promise<UploadedDocument> => {
  const supabase = getSupabaseClient();

  const storage = supabase.storage.from(bucketId);

  let data: { path: string; id: string; fullPath: string } | null = null;
  let error: { message: string } | null = null;

  const uploadResult = await storage.upload(path, file, {
    contentType,
    upsert,
  });
  data = uploadResult.data;
  error = uploadResult.error;

  // Some tenants allow update but block insert on storage.objects.
  // Upsert can still trigger insert policy checks, so fallback to explicit update.
  if (
    upsert &&
    error?.message
      .toLowerCase()
      .includes("new row violates row-level security policy")
  ) {
    const updateResult = await storage.update(path, file, {
      contentType,
      upsert: false,
    });
    data = updateResult.data;
    error = updateResult.error;
  }

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    bucketId,
    name,
    description,
    path: data!.path,
    uploadedAt: new Date().toISOString(),
    type: contentType,
  };
};
