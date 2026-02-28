import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import {
  createInvite,
  revokeInvite,
  resendInvite,
} from "@/lib/supabase/queries/invites";
import { getUserProfile } from "@/lib/supabase/queries/auth";
import { sendInvitationEmail } from "@/lib/email";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const requireTeamManager = async (request: Request) => {
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

  if (!profile || !profile.tenant_id) {
    return {
      error: NextResponse.json(
        { error: "No tenant associated" },
        { status: 403 },
      ),
    };
  }

  // Only tenant_admin and solicitor can manage team
  if (profile.role !== "tenant_admin" && profile.role !== "solicitor") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    user_id: userData.user.id,
    tenant_id: profile.tenant_id,
    role: profile.role,
  };
};

export async function POST(request: Request) {
  const auth = await requireTeamManager(request);
  if (auth.error) return auth.error;

  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "email and role are required" },
        { status: 400 },
      );
    }

    // Validate role - team can only invite paralegal, solicitor, or tenant_admin
    const allowedRoles = ["paralegal", "solicitor", "tenant_admin"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role for team invite" },
        { status: 400 },
      );
    }

    const { token } = await createInvite(
      email,
      role,
      auth.tenant_id,
      auth.user_id,
    );
    if (email) await sendInvitationEmail({ email, token });
    return NextResponse.json({ email, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireTeamManager(request);
  if (auth.error) return auth.error;

  try {
    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: "inviteId is required" },
        { status: 400 },
      );
    }

    const { email, token } = await resendInvite(inviteId);
    if (email) await sendInvitationEmail({ email, token });
    return NextResponse.json({ email, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireTeamManager(request);
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
