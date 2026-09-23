import { NextResponse } from "next/server";

import { sha256Hex } from "@/lib/crypto/hash";
import {
  downloadSignedFile,
  verifyDocusealWebhookSignature,
} from "@/lib/signing/docuseal";
import {
  getStatementDocumentName,
  uploadStorageDocument,
} from "@/lib/signing/statement-document";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_updateStatementStatus } from "@/lib/supabase/mutations";

type DocusealWebhook = {
  event_type?: string;
  event?: { event_type?: string };
  data?: {
    id?: number | string;
    submission_id?: number | string;
    status?: string;
    metadata?: Record<string, string>;
    documents?: Array<{ url?: string; name?: string }>;
  };
};

function metadataValue(
  metadata: Record<string, string> | undefined,
  key: string,
) {
  return metadata?.[key] || metadata?.[key.toUpperCase()] || null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (
      !verifyDocusealWebhookSignature({
        rawBody,
        signatureHeader: request.headers.get("x-docuseal-signature"),
      })
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = (rawBody ? JSON.parse(rawBody) : {}) as DocusealWebhook;
    const eventType = payload.event_type || payload.event?.event_type;
    const status = payload.data?.status;
    if (
      eventType !== "form.completed" &&
      eventType !== "submission.completed" &&
      status !== "completed"
    ) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const submissionId = payload.data?.submission_id
      ? String(payload.data.submission_id)
      : null;
    let statementId = metadataValue(payload.data?.metadata, "statement_id");
    let tenantId = metadataValue(payload.data?.metadata, "tenant_id");

    const supabase = getServiceClient("docuseal_webhook");

    if ((!statementId || !tenantId) && submissionId) {
      const { data: event } = await supabase
        .from("statement_signature_events")
        .select("statement_id, tenant_id")
        .eq("docuseal_submission_id", submissionId)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      statementId = statementId || event?.statement_id || null;
      tenantId = tenantId || event?.tenant_id || null;
    }

    if (!submissionId || !statementId || !tenantId) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const { data: statement, error } = await supabase
      .from("statements")
      .select("id, tenant_id, case_id, witness_name, signed_document, status")
      .eq("id", statementId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error || !statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    if (statement.status === "completed") {
      return NextResponse.json({ ok: true });
    }

    const { data: caseRow } = await supabase
      .from("cases")
      .select("title")
      .eq("id", statement.case_id)
      .maybeSingle();

    const signedFile = await downloadSignedFile(submissionId);
    const signedHash = sha256Hex(signedFile.bytes);
    const existingSignedDocument = statement.signed_document as {
      bucketId?: string;
      path?: string;
      name?: string;
    } | null;
    const unsignedName =
      existingSignedDocument?.name ??
      getStatementDocumentName({
        case: { title: caseRow?.title || "case" },
        statement: { witness_name: statement.witness_name },
      });
    const finalDocName = unsignedName.replace(/\.docx$/i, ".pdf");
    const finalDocPath =
      existingSignedDocument?.path?.replace(/\.docx$/i, ".pdf") ??
      `cases/${statement.case_id}/${statement.id}/submitted/${new Date().toISOString()} ${finalDocName}`;

    const signedDocument = await uploadStorageDocument({
      supabase,
      bucketId: existingSignedDocument?.bucketId ?? statement.tenant_id,
      path: finalDocPath,
      file: signedFile.bytes,
      name: finalDocName,
      description: `Final signed account by ${statement.witness_name}`,
      contentType: signedFile.contentType || "application/pdf",
    });

    await supabase
      .from("statements")
      .update({
        signed_document: signedDocument,
      })
      .eq("id", statement.id);

    await supabase
      .from("statement_signature_events")
      .update({
        signed_document_sha256: signedHash,
      })
      .eq("statement_id", statement.id)
      .eq("docuseal_submission_id", submissionId);

    await SERVERONLY_updateStatementStatus(statement.id, "completed");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "DocuSeal webhook failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
