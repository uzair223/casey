import { NextRequest } from "next/server";

import { handleApiError } from "@/lib/api-utils";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { badRequest, ok } from "@/lib/api-utils/response";
import {
  getFirmChatStatement,
  postFirmChatMessage,
} from "@/lib/witness-chat/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    if (auth.role !== "tenant_admin" && auth.role !== "solicitor" && auth.role !== "paralegal") {
      return badRequest("Only firm staff can message a witness");
    }
    const { id: statementId } = await params;
    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return badRequest("Follow-up message is required");
    if (message.length > 5000) {
      return badRequest("Follow-up message must be 5000 characters or less");
    }

    const statement = await getFirmChatStatement(statementId, auth.tenantId);
    if (!statement) return badRequest("Statement not found");

    await postFirmChatMessage({
      statement,
      userId: auth.userId,
      senderName: auth.profile.display_name || auth.email || "Legal team",
      body: message,
      clientId: null,
      attachments: [],
      fileRequest: null,
    });

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
