import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";
import { getRequestIp, getRequestUserAgent, sha256Hex } from "@/lib/crypto/hash";
import {
  getOrRenderUnsignedStatementBytes,
  getStatementDocumentName,
} from "@/lib/signing/statement-document";
import {
  getStatementSigningMethod,
  recordSignatureEvent,
} from "@/lib/signing/record";
import {
  createEmbeddedSignatureRequest,
  getDocusealOrigin,
} from "@/lib/signing/docuseal";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const data = await SERVERONLY_getFullStatementFromToken(token, false);
    const supabase = getServiceClient("intake_final_review_embedded");

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
    if (signingMethod !== "docuseal") {
      return NextResponse.json(
        { error: "Certified signing is not enabled for this statement." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      signatureName?: string;
      intentAttested?: unknown;
    };
    const signatureName =
      typeof body.signatureName === "string"
        ? body.signatureName.trim()
        : data.statement.witness_name;
    if (!signatureName || body.intentAttested !== true) {
      return NextResponse.json(
        { error: "Name and intent attestation are required." },
        { status: 400 },
      );
    }

    const unsignedBytes = await getOrRenderUnsignedStatementBytes({
      data,
      supabase,
    });
    const created = await createEmbeddedSignatureRequest({
      file: unsignedBytes,
      fileName: getStatementDocumentName(data),
      signerName: signatureName,
      signerEmail: data.statement.witness_email,
      statementId: data.statement.id,
      tenantId: data.tenant_id,
      title: getStatementDocumentName(data),
    });

    await recordSignatureEvent({
      tenantId: data.tenant_id,
      statementId: data.statement.id,
      signerName: signatureName,
      intentAttested: true,
      method: "docuseal",
      ipAddress: getRequestIp(request),
      userAgent: getRequestUserAgent(request),
      unsignedDocumentSha256: sha256Hex(unsignedBytes),
      signedDocumentSha256: null,
      docusealSubmissionId: created.submissionId,
      docusealSubmitterId: created.submitterId,
      docusealSubmitterSlug: created.submitterSlug,
    });

    return NextResponse.json({
      embedSrc: created.embedSrc,
      origin: getDocusealOrigin(),
      submissionId: created.submissionId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start certified signing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
