import { UploadedDocument } from "@/types";
import { getSupabaseClient } from "../client";

export const downloadUploadedDocument = async (
  document: UploadedDocument,
): Promise<Blob> => {
  const supabase = getSupabaseClient();
  const bucketId = document.bucketId;

  if (!bucketId) {
    throw new Error("Uploaded document is missing its bucket id");
  }

  const { data, error } = await supabase.storage
    .from(bucketId)
    .createSignedUrl(document.path, 60 * 10);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create document download link: ${error?.message ?? "unknown error"}`,
    );
  }

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new Error("Failed to download uploaded document");
  }

  return await response.blob();
};
