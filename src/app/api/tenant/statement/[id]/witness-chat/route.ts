import { NextRequest } from "next/server";

import { forbidden, handleApiError } from "@/lib/api-utils";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { badRequest, ok } from "@/lib/api-utils/response";
import {
  readChatForm,
  uploadWitnessChatFiles,
} from "@/lib/witness-chat/files";
import {
  getFirmChatStatement,
  loadWitnessChat,
  postFirmChatMessage,
} from "@/lib/witness-chat/service";

const CHAT_ROLES = new Set(["tenant_admin", "solicitor", "paralegal"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    const { id } = await params;
    const statement = await getFirmChatStatement(id, auth.tenantId);
    if (!statement) return badRequest("Statement not found");
    const snapshot = await loadWitnessChat(statement, "firm", auth.userId);
    return ok(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    if (!CHAT_ROLES.has(auth.role)) {
      throw forbidden("Only firm staff can message a witness");
    }
    const { id } = await params;
    const statement = await getFirmChatStatement(id, auth.tenantId);
    if (!statement) return badRequest("Statement not found");

    const form = await readChatForm(request);
    const attachments = await uploadWitnessChatFiles({
      tenantId: statement.tenantId,
      caseId: statement.caseId,
      statementId: statement.id,
      files: form.files,
    });
    const snapshot = await postFirmChatMessage({
      statement,
      userId: auth.userId,
      senderName: auth.profile.display_name || auth.email || "Legal team",
      body: form.body,
      clientId: form.clientId,
      attachments,
      fileRequest: form.fileRequest,
    });
    return ok(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
