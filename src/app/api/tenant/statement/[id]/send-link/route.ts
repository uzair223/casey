import { NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getStatementForSendLink } from "@/lib/supabase/queries";
import { sendStatementLinkEmail } from "@/lib/email";
import {
  badRequest,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-utils";

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
    const supabase = getServiceClient();
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : "";

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return unauthorized();
    }

    // Get user profile with tenant_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return notFound("User profile not found");
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .single();

    if (tenantError || !tenant?.name) {
      return notFound("Tenant not found");
    }

    const statement = await SERVERONLY_getStatementForSendLink(
      statementId,
      profile.tenant_id,
    );

    if (!statement) {
      return notFound("Statement not found");
    }

    // Check if witness email exists
    if (!statement.witness_email) {
      return badRequest("Witness email not set on this case");
    }

    // Build statement link URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const statementUrl = `${baseUrl}/intake/${statement.token}`;

    await sendStatementLinkEmail({
      to: statement.witness_email,
      tenantName: tenant.name,
      witnessName: statement.witness_name,
      caseTitle: statement.title,
      statementUrl,
    });

    return ok({
      success: true,
      message: "Statement link email sent successfully",
    });
  } catch (error) {
    console.error("Send statement link error:", error);
    return serverError(error);
  }
}
