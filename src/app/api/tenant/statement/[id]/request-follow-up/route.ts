import { env } from "@/lib/env";
import { NextRequest } from "next/server";

import { logAuditEvent } from "@/lib/observability/audit";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { badRequest, ok, serverError } from "@/lib/api-utils/response";
import { sendStatementFollowUpRequestEmail } from "@/lib/email";
import { SERVERONLY_getStatementForSendLink } from "@/lib/supabase/queries";
import { SERVERONLY_saveConversationMessage } from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    const { id: statementId } = await params;

    const body = await request.json().catch(() => ({}));
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return badRequest("Follow-up message is required");
    }

    if (message.length > 2000) {
      return badRequest("Follow-up message must be 2000 characters or less");
    }

    const statement = await SERVERONLY_getStatementForSendLink(
      statementId,
      auth.tenantId,
    );

    if (!statement) {
      return badRequest("Statement not found");
    }

    if (!statement.witness_email) {
      return badRequest("Witness email is not available");
    }

    const supabase = getServiceClient("tenant_request_follow_up");

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", auth.tenantId)
      .single();

    if (tenantError || !tenant?.name) {
      return badRequest("Tenant not found");
    }

    const statementUrl = `${env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/intake/${statement.token}/follow-up`;

    await SERVERONLY_saveConversationMessage(
      statementId,
      "assistant",
      message,
      {
        followUpRequest: true,
        requestedAt: new Date().toISOString(),
        requestedBy: auth.profile.display_name || auth.email || "Legal team",
      },
    );

    await sendStatementFollowUpRequestEmail({
      to: statement.witness_email,
      tenantName: tenant.name,
      caseTitle: statement.title,
      witnessName: statement.witness_name,
      statementUrl,
      requestedBy: auth.profile.display_name || auth.email || "Legal team",
      message,
    });

    await supabase.from("statement_reminder_events").insert({
      tenant_id: auth.tenantId,
      statement_id: statementId,
      created_by_user_id: auth.userId,
      send_type: "follow_up_request",
      recipient_email: statement.witness_email,
      status: "sent",
      metadata: {
        message,
      },
      sent_at: new Date().toISOString(),
    });

    await logAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: "statement.follow_up_request.sent",
      targetType: "statement",
      targetId: statementId,
      metadata: {
        recipient: statement.witness_email,
      },
    });

    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return serverError(error);
  }
}
