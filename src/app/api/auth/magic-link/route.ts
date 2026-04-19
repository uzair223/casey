import { z } from "zod";
import { badRequest, ok, serverError, tooManyRequests } from "@/lib/api-utils";
import { enforceRateLimit, getRateLimitKey } from "@/lib/api-utils/rate-limit";
import { getServiceClient } from "@/lib/supabase/server";
import { sendExistingUserSignInEmail } from "@/lib/email";

const BodySchema = z.object({
  email: z.string().trim().email(),
  inviteCode: z.string().trim().optional(),
});

async function userExistsByEmail(email: string): Promise<boolean> {
  const supabase = getServiceClient("auth_magic_link_user_lookup");
  const target = email.toLowerCase();

  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data.users ?? [];

    if (users.some((user) => user.email?.toLowerCase() === target)) {
      return true;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return false;
}

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

    const exists = await userExistsByEmail(email);
    if (!exists) {
      return badRequest(
        "No account exists for this email. Ask your admin to send an invite first.",
      );
    }

    await sendExistingUserSignInEmail({
      email,
      token: inviteCode ?? "",
    });

    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
