import { z } from "zod";
import {
  badRequest,
  enforcePersistentRateLimit,
  ok,
  serverError,
} from "@/lib/api-utils";
import { sendInvitationEmail } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  email: z.email().trim(),
  inviteCode: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return badRequest("A valid email is required.");
    }

    const email = parsed.data.email.trim().toLowerCase();
    const inviteCode = parsed.data.inviteCode?.trim();

    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "auth:magic-link",
      identifier: email,
      limit: 10,
      windowSeconds: 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (inviteCode) {
      const supabase = getServiceClient("api.auth.magic_link");
      const { data: invite, error } = await supabase
        .from("invites")
        .select("email, accepted_at, expires_at")
        .eq("token", inviteCode)
        .maybeSingle();

      if (
        error ||
        !invite ||
        invite.accepted_at ||
        new Date(invite.expires_at) < new Date()
      ) {
        return badRequest("Invite code is invalid or expired.");
      }

      if (invite.email && invite.email.toLowerCase() !== email) {
        return badRequest("Invite code does not match this email.");
      }
    }

    await sendInvitationEmail({
      email,
      token: inviteCode ?? "",
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
