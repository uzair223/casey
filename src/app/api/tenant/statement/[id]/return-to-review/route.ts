import { env } from "@/lib/env";
import { NextRequest } from "next/server";

import {
  badRequest,
  forbidden,
  ok,
  serverError,
} from "@/lib/api-utils/response";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { sendStatementLinkEmail } from "@/lib/email";
import { SERVERONLY_getStatementForSendLink } from "@/lib/supabase/queries";
import { SERVERONLY_returnStatementToReview } from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";

const RETURNABLE_STATUSES = new Set(["draft", "in_progress", "submitted"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    const { id: statementId } = await params;
    if (auth.role !== "tenant_admin" && auth.role !== "solicitor") {
      return forbidden("Only firm admins and solicitors can return statements.");
    }
    const body = (await request.json().catch(() => ({}))) as {
      status?: unknown;
      notifyWitness?: unknown;
      message?: unknown;
    };

    const status = typeof body.status === "string" ? body.status : "";
    const notifyWitness = body.notifyWitness === true;
    const firmMessage =
      typeof body.message === "string" ? body.message.trim() : "";

    if (!RETURNABLE_STATUSES.has(status)) {
      return badRequest(
        "Status must be draft, in_progress, or submitted when returning to review.",
      );
    }

    if (firmMessage.length > 2000) {
      return badRequest("Message must be 2000 characters or less");
    }

    const statement = await SERVERONLY_getStatementForSendLink(
      statementId,
      auth.tenantId,
    );

    if (!statement) {
      return badRequest("Statement not found");
    }

    await SERVERONLY_returnStatementToReview(
      statementId,
      status as "draft" | "in_progress" | "submitted",
    );

    if (notifyWitness) {
      if (!statement.witness_email) {
        return badRequest("Witness email is not available");
      }

      const supabase = getServiceClient("tenant_return_to_review");
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", auth.tenantId)
        .single();

      if (tenantError || !tenant?.name) {
        return badRequest("Tenant not found");
      }

      const statementUrl = `${env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/intake/${statement.token}`;
      await sendStatementLinkEmail({
        to: statement.witness_email,
        tenantName: tenant.name,
        witnessName: statement.witness_name,
        caseTitle: statement.title,
        statementUrl,
        firmMessage,
        reason: "back_to_review",
      });
    }

    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return serverError(error);
  }
}
