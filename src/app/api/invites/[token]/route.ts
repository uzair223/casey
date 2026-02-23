import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import {
  getInviteByToken,
  acceptInvite,
  getTenantById,
  getInviteByTokenServer,
} from "@/lib/supabase/queries";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const invite = await getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    let tenantName: string | null = null;
    if (invite.tenant_id) {
      const tenant = await getTenantById(invite.tenant_id);
      tenantName = tenant?.name ?? tenantName;
    }

    return NextResponse.json({
      invite: {
        email: invite.email,
        role: invite.role,
        tenantName,
      },
    });
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
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const invite = await getInviteByTokenServer(inviteToken);
    console.log(invite);

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.email) {
      const userEmail = (userData.user.email ?? "").toLowerCase();
      if (userEmail !== invite.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Invite email does not match your account" },
          { status: 403 },
        );
      }
    }

    // Check if firm name is required
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
      userData.user.id,
      displayName.trim(),
      firmName ? firmName.trim() : undefined,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
