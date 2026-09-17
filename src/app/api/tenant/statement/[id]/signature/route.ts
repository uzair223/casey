import { requireTenantUser } from "@/lib/api-utils/auth";
import { forbidden, notFound, ok, serverError } from "@/lib/api-utils";
import { getLatestSignatureEvent } from "@/lib/signing/record";
import { getServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    const { id } = await params;
    const supabase = getServiceClient("signature-certificate");
    const { data: statement, error } = await supabase
      .from("statements")
      .select("id, tenant_id, title, witness_name, witness_email, status")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (error || !statement) {
      return notFound("Statement not found");
    }

    if (
      auth.profile.role !== "app_admin" &&
      statement.tenant_id !== auth.tenantId
    ) {
      return forbidden();
    }

    const event = await getLatestSignatureEvent(statement.id);
    if (!event) {
      return ok({ certificate: null });
    }

    return ok({
      certificate: {
        appName: env.NEXT_PUBLIC_APP_NAME,
        statementId: statement.id,
        statementTitle: statement.title,
        witnessName: statement.witness_name,
        witnessEmail: statement.witness_email,
        signerName: event.signer_name,
        intentAttested: event.intent_attested,
        method: event.method,
        signedAt: event.signed_at,
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        unsignedDocumentSha256: event.unsigned_document_sha256,
        signedDocumentSha256: event.signed_document_sha256,
        dropboxSignatureRequestId: event.dropbox_signature_request_id,
        docusealSubmissionId: event.docuseal_submission_id,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
