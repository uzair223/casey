import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import {
  createInvite,
  revokeInvite,
  resendInvite,
} from "@/lib/supabase/queries/invites";
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

export async function POST(request: Request) {
  const auth = await requireAppAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "email and role are required" },
        { status: 400 },
      );
    }

    // Determine tenant_id based on role
    // For app_admin or tenant_admin (new tenant), tenant_id is null
    // For other roles, this shouldn't be used from admin panel
    const tenant_id =
      role === "app_admin" || role === "tenant_admin" ? null : null;

    const result = await createInvite(email, role, tenant_id, auth.user_id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAppAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "inviteId is required" },
        { status: 400 },
      );
    }

    const result = await resendInvite(inviteId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAppAdmin(request);
  if (auth.error) return auth.error;

  try {
    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "inviteId is required" },
        { status: 400 },
      );
    }

    await revokeInvite(inviteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
