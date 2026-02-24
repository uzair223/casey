import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getCaseForSendLink } from "@/lib/supabase/queries/cases";
import { sendStatementLinkEmail } from "@/lib/email";

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
    const { id: caseId } = await params;
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile with tenant_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", profile.tenant_id)
      .single();

    if (tenantError || !tenant?.name) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get case with statement and magic link info
    const caseData = await getCaseForSendLink(caseId, profile.tenant_id);

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Check if witness email exists
    if (!caseData.statement.witness_email) {
      return NextResponse.json(
        { error: "Witness email not set on this case" },
        { status: 400 },
      );
    }

    // Build statement link URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const statementUrl = `${baseUrl}/statement/${caseData.magicLinkToken}`;

    await sendStatementLinkEmail({
      to: caseData.statement.witness_email,
      tenantName: tenant.name,
      witnessName: caseData.statement.witness_name,
      caseTitle: caseData.case.title,
      statementUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Statement link email sent successfully",
    });
  } catch (error) {
    console.error("Send statement link error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send statement link",
      },
      { status: 500 },
    );
  }
}
