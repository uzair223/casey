import { UploadedDocument } from "@/lib/types";
import { getSupabaseClient } from "../client";

export const uploadFile = async (
  bucketId: string,
  path: string,
  file: File | Blob,
  contentType: string,
): Promise<UploadedDocument> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(bucketId)
    .upload(path, file, { contentType });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    bucketId,
    path: data.path,
    uploadedAt: new Date().toISOString(),
    type: contentType,
  };
};
