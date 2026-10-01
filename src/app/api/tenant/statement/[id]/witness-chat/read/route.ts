import { NextRequest } from "next/server";

import { handleApiError } from "@/lib/api-utils";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { badRequest, ok } from "@/lib/api-utils/response";
import { getFirmChatStatement, markFirmRead } from "@/lib/witness-chat/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantUser(request);
    const { id } = await params;
    const statement = await getFirmChatStatement(id, auth.tenantId);
    if (!statement) return badRequest("Statement not found");
    return ok(await markFirmRead(statement, auth.userId));
  } catch (error) {
    return handleApiError(error);
  }
}
