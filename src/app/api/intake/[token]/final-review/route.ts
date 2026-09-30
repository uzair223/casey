import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import {
  SERVERONLY_updateStatementByToken,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";
import { getRequestIp, getRequestUserAgent, sha256Hex } from "@/lib/crypto/hash";
import {
  decodeSignaturePng,
  decodeSignedDocx,
  statementContentSha256,
} from "@/lib/signing/evidence";
import { recordSignatureEvent } from "@/lib/signing/record";
import { STATEMENT_OF_TRUTH } from "@/lib/signing/statement-of-truth";
import {
  getStatementDocumentName,
  uploadStorageDocument,
} from "@/lib/signing/statement-document";

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
      caseMetadata: data.case.case_metadata ?? {},
      witnessMetadata: data.statement.witness_metadata ?? {},
      config: data.statement.statement_config,
      hasTemplate: Boolean(data.statement.template_document_snapshot?.path),
      canSign:
        data.statement.status === "finalized" ||
        data.statement.status === "demo_published",
      alreadyCompleted: data.statement.status === "completed",
      statementOfTruth: STATEMENT_OF_TRUTH,
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
        { error: "This account is not ready for a final signature." },
        { status: 409 },
      );
    }

    const signerName = data.statement.witness_name?.trim() ?? "";
    if (!signerName) {
      return NextResponse.json(
        { error: "This account has no name to sign with." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      intentAttested?: unknown;
      signedDocumentBase64?: unknown;
      signatureImageBase64?: unknown;
    };

    const intentAttested = body.intentAttested === true;
    const signedBytes = decodeSignedDocx(body.signedDocumentBase64);
    const signatureImage = decodeSignaturePng(body.signatureImageBase64);

    if (!intentAttested || !signedBytes || !signatureImage) {
      return NextResponse.json(
        {
          error:
            "The statement of truth, a signature, and the signed statement are required.",
        },
        { status: 400 },
      );
    }

    const sections =
      data.statement.sections &&
      typeof data.statement.sections === "object" &&
      !Array.isArray(data.statement.sections)
        ? Object.fromEntries(
            Object.entries(data.statement.sections).flatMap(([key, value]) =>
              typeof value === "string" ? [[key, value]] : [],
            ),
          )
        : {};
    const statementHash = statementContentSha256({
      statementId: data.statement.id,
      witnessName: signerName,
      witnessEmail: data.statement.witness_email ?? "",
      sections,
    });
    const signedHash = sha256Hex(signedBytes);
    const signatureImageHash = sha256Hex(signatureImage);

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
      description: `Final signed account by ${signerName}`,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await SERVERONLY_updateStatementByToken(token, {
      signed_document: signedDocument,
      witness_metadata: {
        final_signature_name: signerName,
      },
    });

    await recordSignatureEvent({
      tenantId: data.tenant_id,
      statementId: data.statement.id,
      signerName,
      intentAttested: true,
      attestationText: STATEMENT_OF_TRUTH,
      method: "canvas",
      ipAddress: getRequestIp(request),
      userAgent: getRequestUserAgent(request),
      unsignedDocumentSha256: statementHash,
      signedDocumentSha256: signedHash,
      signatureImageSha256: signatureImageHash,
    });

    await SERVERONLY_updateStatementStatus(data.statement.id, "completed");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit final review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
