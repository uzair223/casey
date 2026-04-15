import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { enforceRateLimit, getRateLimitKey } from "@/lib/api-utils/rate-limit";
import { logAuditEvent } from "@/lib/observability/audit";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

/**
 * POST /api/onboarding
 * Complete user onboarding by setting display_name and optionally creating tenant
 */
export async function POST(request: NextRequest) {
  try {
    const rate = enforceRateLimit({
      key: getRateLimitKey(request, "onboarding"),
      limit: 10,
      windowMs: 60_000,
    });

    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many onboarding attempts. Please try again shortly." },
        { status: 429 },
      );
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { displayName, firmName } = body;

    if (
      !displayName ||
      typeof displayName !== "string" ||
      !displayName.trim()
    ) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 },
      );
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, tenant_id, role, display_name")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "No profile found. Please accept an invite first." },
        { status: 404 },
      );
    }

    // Don't allow onboarding for users who haven't accepted an invite
    if (profile.role === "user") {
      return NextResponse.json(
        { error: "Please accept an invite before completing onboarding" },
        { status: 403 },
      );
    }

    // If user is tenant_admin with no tenant_id, create tenant first
    let tenant_id = profile.tenant_id;

    if (profile.role === "tenant_admin" && !profile.tenant_id) {
      if (!firmName || typeof firmName !== "string" || !firmName.trim()) {
        return NextResponse.json(
          { error: "Firm name is required for tenant admin setup" },
          { status: 400 },
        );
      }

      // Create new tenant
      const { data: newTenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: firmName.trim(),
        })
        .select()
        .single();

      if (tenantError || !newTenant) {
        console.error("Failed to create tenant:", tenantError);
        return NextResponse.json(
          { error: "Failed to create organization" },
          { status: 500 },
        );
      }

      tenant_id = newTenant.id;
    }

    // Update profile with display_name and tenant_id (if created)
    const updateData: { display_name: string; tenant_id?: string } = {
      display_name: displayName.trim(),
    };

    if (tenant_id && !profile.tenant_id) {
      updateData.tenant_id = tenant_id;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    await logAuditEvent({
      tenantId: tenant_id,
      actorUserId: user.id,
      action: "onboarding.completed",
      targetType: "profile",
      targetId: user.id,
      metadata: {
        createdTenant: !!tenant_id && !profile.tenant_id,
      },
    });

    return NextResponse.json({
      success: true,
      displayName: displayName.trim(),
      tenant_id,
    });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete onboarding",
      },
      { status: 500 },
    );
  }
}
