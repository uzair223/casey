import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import {
  SERVERONLY_updateStatementByToken,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import type { UploadedDocument } from "@/types";
import { getServiceClient } from "@/lib/supabase/server";
import { signDoc } from "@/lib/doc-gen";

async function downloadStorageDocument(params: {
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

async function uploadStorageDocument(params: {
  supabase: ReturnType<typeof getServiceClient>;
  bucketId: string;
  path: string;
  file: Blob;
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const data = await SERVERONLY_getFullStatementFromToken(token, false);

    if (!data) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      data.statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    return NextResponse.json({
      tenantId: data.tenant_id,
      caseId: data.case.id,
      caseTitle: data.case.title,
      witnessName: data.statement.witness_name,
      statementId: data.statement.id,
      status: data.statement.status,
      sections: data.statement.sections,
      signedDocument: data.statement.signed_document,
      supportingDocuments: data.statement.supporting_documents,
      canSign:
        data.statement.status === "finalized" ||
        data.statement.status === "demo_published",
      alreadyCompleted: data.statement.status === "completed",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load final review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const data = await SERVERONLY_getFullStatementFromToken(token, false);
    const supabase = getServiceClient("intake_final_review_sign");

    if (!data) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      data.statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    if (["completed", "demo_published"].includes(data.statement.status)) {
      return NextResponse.json({ ok: true });
    }

    if (data.statement.status !== "finalized") {
      return NextResponse.json(
        { error: "This statement is not ready for final witness signature." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      signatureImageDataUrl?: unknown;
      signatureName?: string;
    };

    const signatureImageDataUrl =
      typeof body.signatureImageDataUrl === "string"
        ? body.signatureImageDataUrl.trim()
        : "";
    const signatureName =
      typeof body.signatureName === "string" ? body.signatureName.trim() : "";

    if (!signatureImageDataUrl || !signatureName) {
      return NextResponse.json(
        { error: "signatureImageDataUrl and signatureName are required" },
        { status: 400 },
      );
    }

    const signatureImage = Uint8Array.from(
      Buffer.from(
        signatureImageDataUrl.replace(/^data:image\/png;base64,/, ""),
        "base64",
      ),
    );

    const existingSignedDocument = data.statement.signed_document;
    let signedDocument = existingSignedDocument;

    if (existingSignedDocument?.path) {
      const templateDocument = await downloadStorageDocument({
        supabase,
        bucketId: existingSignedDocument.bucketId ?? data.tenant_id,
        path: existingSignedDocument.path,
      });

      const signedBlob = await signDoc({
        file: templateDocument,
        signatureImage,
        signatureDate: new Date().toLocaleDateString("en-GB"),
      });

      const finalDocName =
        existingSignedDocument.name ||
        `${data.case.title || "case"} ${data.statement.witness_name} Witness Statement.docx`;
      const finalDocPath =
        existingSignedDocument.path ||
        `cases/${data.case.id}/${data.statement.id}/submitted/${new Date().toISOString()} ${finalDocName}`;

      signedDocument = await uploadStorageDocument({
        supabase,
        bucketId: existingSignedDocument.bucketId ?? data.tenant_id,
        path: finalDocPath,
        file: signedBlob,
        name: finalDocName,
        description: `Final signed witness statement by ${signatureName}`,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }

    await SERVERONLY_updateStatementByToken(token, {
      signed_document: signedDocument,
      witness_metadata: {
        final_signature_name: signatureName,
      },
    });

    await SERVERONLY_updateStatementStatus(data.statement.id, "completed");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit final review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
