import "server-only";

import { userError } from "@/lib/api-utils";
import { isAllowedEvidenceType } from "@/lib/evidence";
import { getServiceClient } from "@/lib/supabase/server";
import type { UploadedDocument } from "@/types";

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "file";
}

export async function readChatForm(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const files = Array.from(formData.entries())
      .filter(([key]) => key.startsWith("file_"))
      .map(([, value]) => value)
      .filter((value): value is File => value instanceof File);
    const dueRaw = String(formData.get("fileRequestDueAt") ?? "").trim();
    const label = String(formData.get("fileRequestLabel") ?? "").trim();
    return {
      body: String(formData.get("body") ?? "").trim(),
      clientId: String(formData.get("clientId") ?? "").trim() || null,
      fileRequestId: String(formData.get("fileRequestId") ?? "").trim() || null,
      fileRequest: label
        ? { label, dueAt: dueRaw || null }
        : null,
      files,
    };
  }

  const json = (await request.json().catch(() => ({}))) as {
    body?: unknown;
    clientId?: unknown;
    fileRequestId?: unknown;
    fileRequest?: { label?: unknown; dueAt?: unknown } | null;
  };
  const label =
    typeof json.fileRequest?.label === "string"
      ? json.fileRequest.label.trim()
      : "";
  const dueAt =
    typeof json.fileRequest?.dueAt === "string"
      ? json.fileRequest.dueAt.trim()
      : "";
  return {
    body: typeof json.body === "string" ? json.body.trim() : "",
    clientId: typeof json.clientId === "string" ? json.clientId.trim() : null,
    fileRequestId:
      typeof json.fileRequestId === "string" ? json.fileRequestId.trim() : null,
    fileRequest: label ? { label, dueAt: dueAt || null } : null,
    files: [] as File[],
  };
}

export function assertChatFiles(files: File[]) {
  if (files.length > MAX_FILES) {
    throw userError(`Upload up to ${MAX_FILES} files at a time.`);
  }
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw userError(`${file.name} exceeds the 25MB file size limit.`);
    }
    if (!isAllowedEvidenceType(file)) {
      throw userError(`${file.name} is not an allowed evidence file type.`);
    }
  }
}

export async function uploadWitnessChatFiles(input: {
  tenantId: string;
  caseId: string;
  statementId: string;
  files: File[];
}) {
  if (input.files.length === 0) return [] as UploadedDocument[];
  assertChatFiles(input.files);

  const supabase = getServiceClient("witness-chat-upload");
  const storage = supabase.storage.from(input.tenantId);
  const basePath = `cases/${input.caseId}/${input.statementId}/submitted/follow-up`;
  const uploaded: UploadedDocument[] = [];

  for (const file of input.files) {
    const safeName = sanitizeFilename(file.name);
    const path = `${basePath}/${new Date().toISOString()} ${safeName}`;
    const contentType = file.type || "application/octet-stream";
    const { data, error } = await storage.upload(path, file, {
      contentType,
      upsert: false,
    });
    if (error || !data) {
      throw userError("Failed to upload file", 400, { cause: error });
    }
    uploaded.push({
      name: file.name,
      path: data.path,
      bucketId: input.tenantId,
      type: contentType,
      uploadedAt: new Date().toISOString(),
      group: "follow-up",
    });
  }

  return uploaded;
}
