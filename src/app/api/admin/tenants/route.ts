import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/queries/auth";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const requireAppAdmin = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await getUserProfile(userData.user.id);

  if (profile?.role !== "app_admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user_id: userData.user.id };
};

/**
 * DELETE /api/admin/tenants
 * Revoke access to an entire tenant by removing all tenant member profiles
 * and revoking outstanding tenant-scoped invites.
 */
export async function DELETE(request: Request) {
  const auth = await requireAppAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();

    const { error: invitesError } = await supabase
      .from("invites")
      .delete()
      .eq("tenant_id", tenantId)
      .is("accepted_at", null);

    if (invitesError) {
      throw invitesError;
    }

    const { error: membersError } = await supabase
      .from("profiles")
      .delete()
      .eq("tenant_id", tenantId);

    if (membersError) {
      throw membersError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
