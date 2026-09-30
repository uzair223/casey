import { getServiceClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/observability/audit";
import { env } from "@/lib/env";

export type SignatureMethod = "canvas" | "dropbox_sign";

export async function recordSignatureEvent(params: {
  tenantId: string;
  statementId: string;
  signerName: string;
  intentAttested: boolean;
  attestationText: string;
  method: SignatureMethod;
  ipAddress: string | null;
  userAgent: string | null;
  unsignedDocumentSha256: string | null;
  signedDocumentSha256: string | null;
  signatureImageSha256: string | null;
  dropboxSignatureRequestId?: string | null;
  dropboxSignatureId?: string | null;
}) {
  const supabase = getServiceClient("record-signature-event");
  const { data, error } = await supabase
    .from("statement_signature_events")
    .insert({
      tenant_id: params.tenantId,
      statement_id: params.statementId,
      signer_name: params.signerName,
      intent_attested: params.intentAttested,
      attestation_text: params.attestationText,
      method: params.method,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      unsigned_document_sha256: params.unsignedDocumentSha256,
      signed_document_sha256: params.signedDocumentSha256,
      signature_image_sha256: params.signatureImageSha256,
      dropbox_signature_request_id: params.dropboxSignatureRequestId ?? null,
      dropbox_signature_id: params.dropboxSignatureId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to record signature event");
  }

  await logAuditEvent({
    tenantId: params.tenantId,
    action: "statement.signed",
    targetType: "statement",
    targetId: params.statementId,
    required: true,
    metadata: {
      method: params.method,
      signerName: params.signerName,
      intentAttested: params.intentAttested,
      attestationText: params.attestationText,
      unsignedDocumentSha256: params.unsignedDocumentSha256,
      signedDocumentSha256: params.signedDocumentSha256,
      signatureImageSha256: params.signatureImageSha256,
      dropboxSignatureRequestId: params.dropboxSignatureRequestId ?? null,
      appName: env.NEXT_PUBLIC_APP_NAME,
    },
  });

  return data;
}

export async function getLatestSignatureEvent(statementId: string) {
  const supabase = getServiceClient("get-signature-event");
  const { data, error } = await supabase
    .from("statement_signature_events")
    .select("*")
    .eq("statement_id", statementId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
