import { z } from "zod";
import { badRequest, ok, serverError, tooManyRequests } from "@/lib/api-utils";
import { enforceRateLimit, getRateLimitKey } from "@/lib/api-utils/rate-limit";
import { sendInvitationEmail } from "@/lib/email";

const BodySchema = z.object({
  email: z.email().trim(),
  inviteCode: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const rate = enforceRateLimit({
    key: getRateLimitKey(request, "auth-magic-link"),
    limit: 10,
    windowMs: 60_000,
  });

  if (!rate.ok) {
    return tooManyRequests(
      "Too many magic link attempts. Please try again shortly.",
    );
  }

  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return badRequest("A valid email is required.");
    }

    const { email, inviteCode } = parsed.data;

    await sendInvitationEmail({
      email,
      token: inviteCode ?? "",
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
