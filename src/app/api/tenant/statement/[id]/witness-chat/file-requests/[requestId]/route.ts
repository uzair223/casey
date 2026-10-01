import { NextRequest } from "next/server";

import { forbidden, handleApiError } from "@/lib/api-utils";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { badRequest, ok } from "@/lib/api-utils/response";
import {
  cancelFileRequest,
  getFirmChatStatement,
} from "@/lib/witness-chat/service";

const CHAT_ROLES = new Set(["tenant_admin", "solicitor", "paralegal"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    if (!CHAT_ROLES.has(auth.role)) {
      throw forbidden("Only firm staff can update a file request");
    }
    const { id, requestId } = await params;
    const statement = await getFirmChatStatement(id, auth.tenantId);
    if (!statement) return badRequest("Statement not found");
    const snapshot = await cancelFileRequest({
      statement,
      requestId,
      userId: auth.userId,
    });
    return ok(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
