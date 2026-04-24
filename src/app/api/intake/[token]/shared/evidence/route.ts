import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { SERVERONLY_updateStatementByToken } from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";
import type { UploadedDocument } from "@/types";
import {
  getEvidenceDocuments,
  normalizeEvidenceGroup,
  sanitizeEvidenceGroupForPath,
} from "@/lib/intake-evidence";

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "file";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
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

    const existing = Array.isArray(statement.supporting_documents)
      ? (statement.supporting_documents as UploadedDocument[])
      : [];

    await SERVERONLY_updateStatementByToken(token, {
      supporting_documents: [...existing, ...uploadedDocuments],
    });

    return NextResponse.json({ documents: uploadedDocuments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload evidence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
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

    const existing = getEvidenceDocuments(statement.supporting_documents);
    const nextDocuments = existing.filter(
      (document) => document.path !== targetPath,
    );

    const supabase = getServiceClient("api.intake.shared.evidence.delete");
    await supabase.storage.from(statement.tenant_id).remove([targetPath]);

    await SERVERONLY_updateStatementByToken(token, {
      supporting_documents: nextDocuments,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove evidence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
