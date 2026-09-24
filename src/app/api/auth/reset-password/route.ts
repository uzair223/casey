import { z } from "zod";
import {
  badRequest,
  enforcePersistentRateLimit,
  ok,
  serverError,
} from "@/lib/api-utils";
import { sendPasswordResetEmail } from "@/lib/email";

const BodySchema = z.object({
  email: z.email().trim(),
});

function isUnknownUserError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /user .*not found|email not found|unable to find|does not exist|not been registered/i.test(
    message,
  );
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return badRequest("A valid email is required.");
    }

    const email = parsed.data.email.trim().toLowerCase();

    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "auth:password-reset",
      identifier: email,
      limit: 5,
      windowSeconds: 10 * 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    try {
      // The link carries token_hash so it can be opened in any browser.
      // Client resetPasswordForEmail uses PKCE, which only works in the
      // browser that requested the email.
      await sendPasswordResetEmail({ email });
    } catch (error) {
      if (!isUnknownUserError(error)) {
        throw error;
      }
    }

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
