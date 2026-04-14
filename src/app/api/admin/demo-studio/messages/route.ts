import { badRequest, ok, requireAppAdmin, serverError } from "@/lib/api-utils";
import { SERVERONLY_listConversationMessages } from "@/lib/supabase/queries";
import { SERVERONLY_createConversationMessage } from "@/lib/supabase/mutations";

type CreateMessageRequest = {
  statementId?: string;
  role?: "user" | "assistant" | "system";
  content?: string;
  meta?: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  try {
    await requireAppAdmin(request);
    const { searchParams } = new URL(request.url);
    const statementId = searchParams.get("statementId");

    if (!statementId) {
      return badRequest("statementId is required");
    }

    const messages = await SERVERONLY_listConversationMessages(statementId);
    return ok({ messages });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAppAdmin(request);
    const payload = (await request.json()) as CreateMessageRequest;

    if (!payload.statementId) {
      return badRequest("statementId is required");
    }

    if (
      !payload.role ||
      !["user", "assistant", "system"].includes(payload.role)
    ) {
      return badRequest("role must be user, assistant, or system");
    }

    const content = payload.content?.trim();
    if (!content) {
      return badRequest("content is required");
    }

    const message = await SERVERONLY_createConversationMessage({
      statementId: payload.statementId,
      role: payload.role,
      content,
      meta: payload.meta,
    });

    return ok({ message });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error, { "Statement not found": 404 });
  }
}
