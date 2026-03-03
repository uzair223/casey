import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/lib/supabase/queries";

type InviteRow = {
  id: string;
  email: string | null;
  token: string;
  tenant_id: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
};

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const getAuthenticatedUserAndProfile = async (request: Request) => {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return {
    supabase,
    user: userData.user,
    profile,
  };
};

const fetchInviteWithTenantName = async (
  supabase: ReturnType<typeof getServiceClient>,
  token: string,
) => {
  const { data: invite, error } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) return null;

  const inviteRow = invite as InviteRow;
  if (inviteRow.accepted_at || new Date(inviteRow.expires_at) < new Date()) {
    return null;
  }

  let tenant_name: string | null = null;
  if (inviteRow.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", inviteRow.tenant_id)
      .maybeSingle();
    tenant_name = tenant?.name ?? null;
  }

  return { ...inviteRow, tenant_name };
};

const canUserReadInvite = (
  invite: InviteRow,
  userEmail: string,
  profile: { role?: string | null; tenant_id?: string | null } | null,
) => {
  const normalizedInviteEmail = invite.email?.toLowerCase();
  const normalizedUserEmail = userEmail.toLowerCase();

  if (normalizedInviteEmail && normalizedInviteEmail === normalizedUserEmail) {
    return true;
  }

  if (invite.email === null) {
    return true;
  }

  if (profile?.role === "app_admin") {
    return true;
  }

  if (
    invite.tenant_id &&
    profile?.tenant_id === invite.tenant_id &&
    (profile.role === "tenant_admin" || profile.role === "solicitor")
  ) {
    return true;
  }

  return false;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const auth = await getAuthenticatedUserAndProfile(request);
    if (auth.error) return auth.error;

    const { token } = await params;
    const invite = await fetchInviteWithTenantName(auth.supabase, token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (!canUserReadInvite(invite, auth.user.email ?? "", auth.profile)) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    return NextResponse.json({ invite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const auth = await getAuthenticatedUserAndProfile(request);
    if (auth.error) return auth.error;

    const { token: inviteToken } = await params;
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

    const invite = await fetchInviteWithTenantName(auth.supabase, inviteToken);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (!canUserReadInvite(invite, auth.user.email ?? "", auth.profile)) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.email) {
      const userEmail = (auth.user.email ?? "").toLowerCase();
      if (userEmail !== invite.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Invite email does not match your account" },
          { status: 403 },
        );
      }
    }

    if (invite.role === "tenant_admin" && !invite.tenant_id) {
      if (!firmName || typeof firmName !== "string" || !firmName.trim()) {
        return NextResponse.json(
          { error: "Firm name is required for new tenant admin" },
          { status: 400 },
        );
      }
    }

    await acceptInvite(
      inviteToken,
      auth.user.id,
      displayName.trim(),
      firmName ? firmName.trim() : undefined,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
