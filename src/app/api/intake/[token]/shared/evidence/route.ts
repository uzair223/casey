import { NextResponse } from "next/server";
import { enforcePersistentRateLimit, handleApiError } from "@/lib/api-utils";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import {
  SERVERONLY_createWitnessSupportingDocuments,
  SERVERONLY_deleteWitnessSupportingDocument,
} from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";
import type { UploadedDocument } from "@/types";
import {
  getEvidenceDocuments,
  normalizeEvidenceGroup,
  sanitizeEvidenceGroupForPath,
} from "@/lib/evidence";

const MAX_EVIDENCE_FILES = 10;
const MAX_EVIDENCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/",
  "audio/",
  "video/",
] as const;

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "file";
}

function isAllowedEvidenceType(file: File) {
  const type = file.type || "application/octet-stream";
  return ALLOWED_EVIDENCE_TYPES.some((allowed) =>
    allowed.endsWith("/") ? type.startsWith(allowed) : type === allowed,
  );
}

function getEvidencePathPrefix(statement: {
  case_id: string;
  id: string;
}) {
  return `cases/${statement.case_id}/${statement.id}/evidence/`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "intake:evidence:upload",
      identifier: token,
      limit: 20,
      windowSeconds: 60 * 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      return NextResponse.json({ error: "Link not available" }, { status: 404 });
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const formData = await request.formData();
    const rawGroup = formData.get("group");
    const group =
      typeof rawGroup === "string" ? normalizeEvidenceGroup(rawGroup) : "other";

    const files = Array.from(formData.entries())
      .filter(([key, value]) => key.startsWith("file_") && value instanceof File)
      .map(([, value]) => value as File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    if (files.length > MAX_EVIDENCE_FILES) {
      return NextResponse.json(
        { error: `Upload up to ${MAX_EVIDENCE_FILES} files at a time.` },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `${file.name} exceeds the 25MB file size limit.` },
          { status: 400 },
        );
      }

      if (!isAllowedEvidenceType(file)) {
        return NextResponse.json(
          { error: `${file.name} is not an allowed evidence file type.` },
          { status: 400 },
        );
      }
    }

    const supabase = getServiceClient("api.intake.shared.evidence");
    const storage = supabase.storage.from(statement.tenant_id);
    const groupPath = sanitizeEvidenceGroupForPath(group);

    const uploadedDocuments: UploadedDocument[] = [];

    for (const file of files) {
      const fileName = sanitizeFilename(file.name);
      const path = `cases/${statement.case_id}/${statement.id}/evidence/${groupPath}/${Date.now()}-${fileName}`;
      const { data, error } = await storage.upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (error) {
        throw error;
      }

      uploadedDocuments.push({
        bucketId: statement.tenant_id,
        name: file.name,
        path: data.path,
        type: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        group,
      });
    }

    await SERVERONLY_createWitnessSupportingDocuments({
      tenantId: statement.tenant_id,
      caseId: statement.case_id,
      statementId: statement.id,
      witnessName: statement.witness_name,
      witnessEmail: statement.witness_email,
      documents: uploadedDocuments,
    });

    return NextResponse.json({ documents: uploadedDocuments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "intake:evidence:delete",
      identifier: token,
      limit: 30,
      windowSeconds: 60 * 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      return NextResponse.json({ error: "Link not available" }, { status: 404 });
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const body = (await request.json()) as { path?: string };
    const targetPath = body.path?.trim();

    if (!targetPath) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const existing = getEvidenceDocuments(
      statement.supporting_documents.map((row) => row.document),
    );
    const targetDocument = existing.find(
      (document) => document.path === targetPath,
    );

    if (
      !targetDocument ||
      (targetDocument.bucketId ?? statement.tenant_id) !==
        statement.tenant_id ||
      !targetPath.startsWith(getEvidencePathPrefix(statement))
    ) {
      return NextResponse.json(
        { error: "Requested evidence document not found" },
        { status: 404 },
      );
    }

    const deleted = await SERVERONLY_deleteWitnessSupportingDocument({
      tenantId: statement.tenant_id,
      statementId: statement.id,
      documentPath: targetPath,
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "Requested evidence document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
