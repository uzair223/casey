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

function ensureUploadedDocument(value: unknown): UploadedDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const doc = value as Partial<UploadedDocument>;
  if (
    typeof doc.name !== "string" ||
    typeof doc.path !== "string" ||
    typeof doc.type !== "string" ||
    typeof doc.uploadedAt !== "string"
  ) {
    return null;
  }

  return {
    bucketId: typeof doc.bucketId === "string" ? doc.bucketId : undefined,
    name: doc.name,
    description:
      typeof doc.description === "string" ? doc.description : undefined,
    path: doc.path,
    type: doc.type,
    uploadedAt: doc.uploadedAt,
  };
}

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
      caseTitle: data.case.title,
      witnessName: data.statement.witness_name,
      statementId: data.statement.id,
      status: data.statement.status,
      sections: data.statement.sections,
      signedDocument: data.statement.signed_document,
      supportingDocuments: data.statement.supporting_documents,
      canSign: data.statement.status === "finalized",
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
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    if (data.statement.status === "completed") {
      return NextResponse.json({ ok: true });
    }

    if (data.statement.status !== "finalized") {
      return NextResponse.json(
        { error: "This statement is not ready for final witness signature." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      signatureDocument?: unknown;
      signatureName?: string;
    };

    const signatureDocument = ensureUploadedDocument(body.signatureDocument);
    const signatureName =
      typeof body.signatureName === "string" ? body.signatureName.trim() : "";

    if (!signatureDocument || !signatureName) {
      return NextResponse.json(
        { error: "signatureDocument and signatureName are required" },
        { status: 400 },
      );
    }

    const signatureImage = await downloadStorageDocument({
      supabase,
      bucketId: signatureDocument.bucketId ?? data.tenant_id,
      path: signatureDocument.path,
    });

    const existingSignedDocument = data.statement.signed_document;
    if (!existingSignedDocument?.path) {
      return NextResponse.json(
        {
          error:
            "Reviewed statement document is missing. Please regenerate or upload the statement before final signature.",
        },
        { status: 409 },
      );
    }

    const templateDocument = await downloadStorageDocument({
      supabase,
      bucketId: existingSignedDocument.bucketId ?? data.tenant_id,
      path: existingSignedDocument.path,
    });

    const signedBlob = await signDoc({
      file: templateDocument,
      signatureImage,
    });

    const finalDocName =
      existingSignedDocument?.name ||
      `${data.case.title || "case"} ${data.statement.witness_name} Witness Statement.docx`;
    const finalDocPath =
      existingSignedDocument?.path ||
      `statements/${data.case.id}/${data.statement.id}/${new Date().toISOString()} ${finalDocName}`;

    const signedDocument = await uploadStorageDocument({
      supabase,
      bucketId: existingSignedDocument?.bucketId ?? data.tenant_id,
      path: finalDocPath,
      file: signedBlob,
      name: finalDocName,
      description: `Final signed witness statement by ${signatureName}`,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const existingSupporting = Array.isArray(
      data.statement.supporting_documents,
    )
      ? (data.statement.supporting_documents as UploadedDocument[])
      : [];

    const nextSupporting = [
      ...existingSupporting,
      {
        ...signatureDocument,
        description: `Final witness signature by ${signatureName}`,
      },
    ];

    await SERVERONLY_updateStatementByToken(token, {
      signed_document: signedDocument,
      supporting_documents: nextSupporting,
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
