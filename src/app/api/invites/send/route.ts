import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getUserProfile } from "@/lib/supabase/queries/auth";
import { sendInvitationEmail } from "@/lib/email";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const requireInviteSender = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await getUserProfile(userData.user.id);

  if (!profile) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const isAppAdmin = profile.role === "app_admin";
  const isTeamManager =
    !!profile.tenant_id &&
    (profile.role === "tenant_admin" || profile.role === "solicitor");

  if (!isAppAdmin && !isTeamManager) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user_id: userData.user.id };
};

export async function POST(request: Request) {
  const auth = await requireInviteSender(request);
  if (auth.error) return auth.error;

  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: "email and token are required" },
        { status: 400 },
      );
    }

    await sendInvitationEmail({ email, token });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
