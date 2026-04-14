import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import { sendInvitationEmail } from "@/lib/email";
import { enforceRateLimit, getRateLimitKey } from "@/lib/api-utils/rate-limit";
import { logAuditEvent } from "@/lib/audit";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api-utils";

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
      error: unauthorized(),
    };
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: unauthorized(),
    };
  }

  const profile = await SERVERONLY_getUserProfile(userData.user.id);

  if (!profile) {
    return {
      error: forbidden(),
    };
  }

  const isAppAdmin = profile.role === "app_admin";
  const isTeamManager =
    !!profile.tenant_id &&
    (profile.role === "tenant_admin" || profile.role === "solicitor");

  if (!isAppAdmin && !isTeamManager) {
    return {
      error: forbidden(),
    };
  }

  return { user_id: userData.user.id, profile };
};

export async function POST(request: Request) {
  const rate = enforceRateLimit({
    key: getRateLimitKey(request, "invite-send"),
    limit: 20,
    windowMs: 60_000,
  });

  if (!rate.ok) {
    return tooManyRequests("Too many invite sends. Please try again shortly.");
  }

  const auth = await requireInviteSender(request);
  if (auth.error) return auth.error;

  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return badRequest("email and token are required");
    }

    const supabase = getServiceClient();
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("tenant_id, email, accepted_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return notFound("Invite not found");
    }

    if (invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      return badRequest("Invite is no longer valid");
    }

    const isAppAdmin = auth.profile.role === "app_admin";
    if (!isAppAdmin && invite.tenant_id !== auth.profile.tenant_id) {
      return forbidden();
    }

    if (
      invite.email &&
      invite.email.toLowerCase() !== String(email).toLowerCase()
    ) {
      return badRequest("Invite email does not match recipient email");
    }

    await sendInvitationEmail({ email, token });

    await logAuditEvent({
      tenantId: invite.tenant_id,
      actorUserId: auth.user_id,
      action: "invite.email.sent",
      targetType: "invite",
      targetId: token,
      metadata: {
        email,
      },
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
