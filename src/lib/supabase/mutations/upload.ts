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

  const { data, error } = await supabase.storage
    .from(bucketId)
    .upload(path, file, { contentType, upsert });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    bucketId,
    name,
    description,
    path: data.path,
    uploadedAt: new Date().toISOString(),
    type: contentType,
  };
};
