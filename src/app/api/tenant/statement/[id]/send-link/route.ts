import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getStatementForSendLink } from "@/lib/supabase/queries";
import { sendStatementLinkEmail } from "@/lib/email";
import {
  badRequest,
  enforcePersistentRateLimit,
  notFound,
  ok,
  serverError,
} from "@/lib/api-utils";
import { requireTenantManager } from "@/lib/api-utils/auth";

/**
 * POST /api/cases/[id]/send-link
 * Sends statement link email to witness
 * Requires: User is member of case's tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: statementId } = await params;
    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "tenant:statement:send-link",
      identifier: statementId,
      limit: 20,
      windowSeconds: 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const auth = await requireTenantManager(request);

    const supabase = getServiceClient();
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name, dpa_signed_at")
      .eq("id", auth.tenantId)
      .single();

    if (tenantError || !tenant?.name) {
      return notFound("Tenant not found");
    }

    if (!tenant.dpa_signed_at) {
      return NextResponse.json(
        {
          error:
            "A firm admin needs to accept the data processing addendum before the first witness link.",
          code: "dpa_required",
        },
        { status: 409 },
      );
    }

    const statement = await SERVERONLY_getStatementForSendLink(
      statementId,
      auth.tenantId,
    );

    if (!statement) {
      return notFound("Statement not found");
    }

    if (!statement.witness_email) {
      return badRequest("Witness email not set on this case");
    }

    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown;
    };
    const firmMessage =
      typeof body.message === "string" ? body.message.trim() : "";
    if (firmMessage.length > 2000) {
      return badRequest("Message must be 2000 characters or less");
    }

    const baseUrl = env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const statementUrl = `${baseUrl}/intake/${statement.token}`;

    await sendStatementLinkEmail({
      to: statement.witness_email,
      tenantName: tenant.name,
      witnessName: statement.witness_name,
      caseTitle: statement.title,
      statementUrl,
      ...(firmMessage ? { firmMessage } : {}),
    });

    return ok({
      success: true,
      message: "Statement link email sent successfully",
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error("Send statement link error:", error);
    return serverError(error);
  }
}
