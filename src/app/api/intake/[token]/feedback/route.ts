import {
  badRequest,
  enforcePersistentRateLimit,
  handleApiError,
  notFound,
  ok,
} from "@/lib/api-utils";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { WitnessSurveySchema } from "@/lib/schema";
import {
  SERVERONLY_hasWitnessSurvey,
  SERVERONLY_insertProductFeedback,
} from "@/lib/supabase/mutations";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import type { StatementStatus } from "@/types";

const FEEDBACK_STATUSES = new Set<StatementStatus>([
  "submitted",
  "finalized",
  "completed",
  "locked",
]);

function isDemoStatus(status: StatementStatus) {
  return status === "demo" || status === "demo_published";
}

function truncate(value: string | null, max: number) {
  if (!value) return null;
  return value.slice(0, max);
}

async function getIntakeStatement(token: string) {
  const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
  if (!statement) {
    throw notFound("Link not available");
  }
  return statement;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const statement = await getIntakeStatement(token);
    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    if (isDemoStatus(statement.status)) {
      return ok({ submitted: false });
    }

    const submitted = await SERVERONLY_hasWitnessSurvey(statement.id);
    return ok({ submitted });
  } catch (error) {
    return handleApiError(error, {
      defaultMessage: "Failed to load feedback status",
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const statement = await getIntakeStatement(token);

    if (isDemoStatus(statement.status)) {
      return badRequest("Feedback is not collected on demo intakes.");
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    if (!FEEDBACK_STATUSES.has(statement.status)) {
      return badRequest("Submit your statement before sharing feedback.");
    }

    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "intake:feedback",
      identifier: statement.id,
      limit: 8,
      windowSeconds: 60 * 60,
    });
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const payload = await request.json().catch(() => null);
    const parsed = WitnessSurveySchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message || "Choose a rating from 1 to 5.",
      );
    }

    await SERVERONLY_insertProductFeedback({
      source: "witness_survey",
      kind: "survey",
      rating: parsed.data.rating,
      message: parsed.data.message ?? null,
      page_path: "/intake/interview",
      user_agent: truncate(request.headers.get("user-agent"), 400),
      statement_id: statement.id,
      tenant_id: statement.tenant_id,
      submitted_by_user_id: null,
    });

    return ok({ success: true });
  } catch (error) {
    return handleApiError(error, {
      defaultMessage: "Failed to save feedback",
    });
  }
}
