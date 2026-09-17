import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import {
  SERVERONLY_updateStatementByToken,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";
import { signDoc } from "@/lib/doc-gen";
import { getRequestIp, getRequestUserAgent, sha256Hex } from "@/lib/crypto/hash";
import {
  getOrRenderUnsignedStatementBytes,
  getStatementDocumentName,
  uploadStorageDocument,
} from "@/lib/signing/statement-document";
import {
  getStatementSigningMethod,
  recordSignatureEvent,
} from "@/lib/signing/record";

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

    const signingMethod = await getStatementSigningMethod({
      tenantId: data.tenant_id,
      statementStatus: data.statement.status,
    });

    return NextResponse.json({
      tenantId: data.tenant_id,
      caseId: data.case.id,
      caseTitle: data.case.title,
      witnessName: data.statement.witness_name,
      witnessEmail: data.statement.witness_email,
      statementId: data.statement.id,
      status: data.statement.status,
      sections: data.statement.sections,
      signedDocument: data.statement.signed_document,
      documentName:
        data.statement.signed_document?.name ?? getStatementDocumentName(data),
      supportingDocuments: data.statement.supporting_documents.map(
        (row) => row.document,
      ),
      canSign:
        data.statement.status === "finalized" ||
        data.statement.status === "demo_published",
      alreadyCompleted: data.statement.status === "completed",
      signingMethod,
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

    const signingMethod = await getStatementSigningMethod({
      tenantId: data.tenant_id,
      statementStatus: data.statement.status,
    });
    if (signingMethod !== "canvas") {
      return NextResponse.json(
        { error: "This statement must be signed with the certified provider." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      signatureImageDataUrl?: unknown;
      signatureName?: string;
      intentAttested?: unknown;
    };

    const signatureImageDataUrl =
      typeof body.signatureImageDataUrl === "string"
        ? body.signatureImageDataUrl.trim()
        : "";
    const signatureName =
      typeof body.signatureName === "string" ? body.signatureName.trim() : "";
    const intentAttested = body.intentAttested === true;

    if (!signatureImageDataUrl || !signatureName || !intentAttested) {
      return NextResponse.json(
        {
          error:
            "signatureImageDataUrl, signatureName, and intent attestation are required",
        },
        { status: 400 },
      );
    }

    const signatureImage = Uint8Array.from(
      Buffer.from(
        signatureImageDataUrl.replace(/^data:image\/png;base64,/, ""),
        "base64",
      ),
    );

    const unsignedBytes = await getOrRenderUnsignedStatementBytes({
      data,
      supabase,
    });
    const unsignedHash = sha256Hex(unsignedBytes);

    const signedBlob = await signDoc({
      file: unsignedBytes,
      signatureImage,
      signatureDate: new Date().toLocaleDateString("en-GB"),
    });
    const signedBytes = new Uint8Array(await signedBlob.arrayBuffer());
    const signedHash = sha256Hex(signedBytes);

    const existingSignedDocument = data.statement.signed_document;
    const finalDocName =
      existingSignedDocument?.name ?? getStatementDocumentName(data);
    const finalDocPath =
      existingSignedDocument?.path ??
      `cases/${data.case.id}/${data.statement.id}/submitted/${new Date().toISOString()} ${finalDocName}`;

    const signedDocument = await uploadStorageDocument({
      supabase,
      bucketId: existingSignedDocument?.bucketId ?? data.tenant_id,
      path: finalDocPath,
      file: signedBytes,
      name: finalDocName,
      description: `Final signed witness statement by ${signatureName}`,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await SERVERONLY_updateStatementByToken(token, {
      signed_document: signedDocument,
      witness_metadata: {
        final_signature_name: signatureName,
      },
    });

    await recordSignatureEvent({
      tenantId: data.tenant_id,
      statementId: data.statement.id,
      signerName: signatureName,
      intentAttested: true,
      method: "canvas",
      ipAddress: getRequestIp(request),
      userAgent: getRequestUserAgent(request),
      unsignedDocumentSha256: unsignedHash,
      signedDocumentSha256: signedHash,
    });

    await SERVERONLY_updateStatementStatus(data.statement.id, "completed");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit final review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
