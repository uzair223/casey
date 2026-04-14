import { badRequest, ok, requireAppAdmin, serverError } from "@/lib/api-utils";
import {
  SERVERONLY_deleteConversationMessage,
  SERVERONLY_updateConversationMessage,
} from "@/lib/supabase/mutations";

type UpdateMessageRequest = {
  content?: string;
  meta?: Record<string, unknown> | null;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    await requireAppAdmin(request);
    const { messageId } = await params;
    const payload = (await request.json()) as UpdateMessageRequest;

    const updatePayload: UpdateMessageRequest = {};

    if (payload.content !== undefined) {
      const content = payload.content.trim();
      if (!content) {
        return badRequest("content cannot be empty");
      }
      updatePayload.content = content;
    }

    if (payload.meta !== undefined) {
      updatePayload.meta = payload.meta ?? null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return badRequest("No fields to update");
    }

    const message = await SERVERONLY_updateConversationMessage(
      messageId,
      updatePayload,
    );

    return ok({ message });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error, { "Message not found": 404 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  try {
    await requireAppAdmin(request);
    const { messageId } = await params;
    await SERVERONLY_deleteConversationMessage(messageId);

    return ok({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error, { "Message not found": 404 });
  }
}
