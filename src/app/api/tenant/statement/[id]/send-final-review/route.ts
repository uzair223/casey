import { env } from "@/lib/env";
import { NextRequest } from "next/server";

import { logAuditEvent } from "@/lib/observability/audit";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { badRequest, ok, serverError } from "@/lib/api-utils/response";
import { sendStatementFinalReviewRequestEmail } from "@/lib/email";
import {
  SERVERONLY_getStatementForSendLink,
  SERVERONLY_getStatementSubmissionNotificationRecipients,
} from "@/lib/supabase/queries";
import {
  SERVERONLY_createUserNotifications,
  SERVERONLY_updateStatementStatus,
} from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    const { id: statementId } = await params;

    const statement = await SERVERONLY_getStatementForSendLink(
      statementId,
      auth.tenantId,
    );
    const memberRecipients =
      await SERVERONLY_getStatementSubmissionNotificationRecipients(
        statementId,
      );

    if (!statement) {
      return badRequest("Statement not found");
    }

    if (!statement.witness_email) {
      return badRequest("Witness email is not available");
    }

    const supabase = getServiceClient("tenant_send_final_review");

    const { data: statementStatus, error: statusError } = await supabase
      .from("statements")
      .select("status")
      .eq("id", statementId)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (statusError || !statementStatus) {
      return badRequest("Statement not found");
    }

    if (
      statementStatus.status !== "submitted" &&
      statementStatus.status !== "finalized"
    ) {
      return badRequest(
        "Only submitted statements can be finalized for witness review.",
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", auth.tenantId)
      .single();

    const { data: preferences } = await supabase
      .from("tenant_notification_preferences")
      .select("submissions_channel")
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (tenantError || !tenant?.name) {
      return badRequest("Tenant not found");
    }

    if (statementStatus.status === "submitted") {
      await SERVERONLY_updateStatementStatus(statementId, "finalized");
    }

    const reviewUrl = `${env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/intake/${statement.token}/final-review`;

    const submissionsChannel = preferences?.submissions_channel ?? "email";
    const inAppRecipients = memberRecipients.recipientUserIds.filter(
      (userId) => userId !== auth.userId,
    );

    if (submissionsChannel === "in_app" || submissionsChannel === "both") {
      await SERVERONLY_createUserNotifications({
        tenantId: auth.tenantId,
        recipientUserIds: inAppRecipients,
        actorUserId: auth.userId,
        notificationType: "statement_final_review_requested",
        entityType: "statement",
        entityId: statementId,
        title: "Final review sent to witness",
        body: `Finalized statement for ${statement.witness_name || "witness"} was sent for final signature in ${memberRecipients.statementTitle}.`,
        linkPath: `/cases/${memberRecipients.caseId}?statement=${statementId}`,
        metadata: {
          witnessName: statement.witness_name,
          caseTitle: memberRecipients.statementTitle,
        },
      });
    }

    await sendStatementFinalReviewRequestEmail({
      to: statement.witness_email,
      tenantName: tenant.name,
      caseTitle: statement.title,
      witnessName: statement.witness_name,
      reviewUrl,
    });

    await logAuditEvent({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      action: "statement.final_review_request.sent",
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
