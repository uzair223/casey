import { getServiceClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/observability/audit";
import { env } from "@/lib/env";
import { FREE_CASE_LIMIT } from "@/lib/billing/plans";
import { isDocusealConfigured } from "./docuseal";

export type SignatureMethod = "canvas" | "docuseal";

export async function getTenantBillingStatus(tenantId: string) {
  const supabase = getServiceClient("signing-tenant-billing");
  const { data } = await supabase
    .from("tenants")
    .select("billing_status")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.billing_status ?? "trial";
}

export async function getStatementSigningMethod(params: {
  tenantId: string;
  statementStatus: string;
}): Promise<SignatureMethod> {
  if (
    ["demo", "demo_published"].includes(params.statementStatus) ||
    !isDocusealConfigured()
  ) {
    return "canvas";
  }

  const billingStatus = await getTenantBillingStatus(params.tenantId);
  if (billingStatus === "active") return "docuseal";

  const supabase = getServiceClient("signing-free-case-count");
  const { count, error } = await supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", params.tenantId);
  if (error) return "canvas";

  return (count ?? 0) <= FREE_CASE_LIMIT ? "docuseal" : "canvas";
}

export async function recordSignatureEvent(params: {
  tenantId: string;
  statementId: string;
  signerName: string;
  intentAttested: boolean;
  method: SignatureMethod;
  ipAddress: string | null;
  userAgent: string | null;
  unsignedDocumentSha256: string | null;
  signedDocumentSha256: string | null;
  dropboxSignatureRequestId?: string | null;
  dropboxSignatureId?: string | null;
  docusealSubmissionId?: string | null;
  docusealSubmitterId?: string | null;
  docusealSubmitterSlug?: string | null;
}) {
  const supabase = getServiceClient("record-signature-event");
  const { data, error } = await supabase
    .from("statement_signature_events")
    .insert({
      tenant_id: params.tenantId,
      statement_id: params.statementId,
      signer_name: params.signerName,
      intent_attested: params.intentAttested,
      method: params.method,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      unsigned_document_sha256: params.unsignedDocumentSha256,
      signed_document_sha256: params.signedDocumentSha256,
      dropbox_signature_request_id: params.dropboxSignatureRequestId ?? null,
      dropbox_signature_id: params.dropboxSignatureId ?? null,
      docuseal_submission_id: params.docusealSubmissionId ?? null,
      docuseal_submitter_id: params.docusealSubmitterId ?? null,
      docuseal_submitter_slug: params.docusealSubmitterSlug ?? null,
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
      unsignedDocumentSha256: params.unsignedDocumentSha256,
      signedDocumentSha256: params.signedDocumentSha256,
      dropboxSignatureRequestId: params.dropboxSignatureRequestId ?? null,
      docusealSubmissionId: params.docusealSubmissionId ?? null,
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
