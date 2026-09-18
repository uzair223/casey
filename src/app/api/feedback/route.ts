import {
  badRequest,
  enforcePersistentRateLimit,
  handleApiError,
  ok,
  requireUser,
} from "@/lib/api-utils";
import { FirmFeedbackSchema } from "@/lib/schema";
import { SERVERONLY_insertProductFeedback } from "@/lib/supabase/mutations";

function truncate(value: string | null | undefined, max: number) {
  if (!value) return null;
  return value.slice(0, max);
}

export async function POST(request: Request) {
  try {
    const { userId, profile } = await requireUser(request);

    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "feedback:firm",
      identifier: userId,
      limit: 12,
      windowSeconds: 60 * 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const payload = await request.json().catch(() => null);
    const parsed = FirmFeedbackSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message ||
          "Please add a short description.",
      );
    }

    await SERVERONLY_insertProductFeedback({
      source: "firm_feedback",
      kind: parsed.data.kind,
      rating: null,
      message: parsed.data.message,
      page_path: truncate(parsed.data.pagePath, 200),
      user_agent: truncate(request.headers.get("user-agent"), 400),
      statement_id: null,
      tenant_id: profile.tenant_id,
      submitted_by_user_id: userId,
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error, {
      defaultMessage: "Failed to save feedback",
    });
  }
}
