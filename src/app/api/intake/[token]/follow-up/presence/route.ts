import { NextResponse } from "next/server";

import { enforcePersistentRateLimit, handleApiError } from "@/lib/api-utils";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import {
  touchWitnessPresence,
  type ChatStatement,
} from "@/lib/witness-chat/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "intake:witness-chat:presence",
      identifier: token,
      limit: 600,
      windowSeconds: 60 * 60,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      return NextResponse.json({ error: "Link not available" }, { status: 404 });
    }
    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "view",
    );
    if (accessError) return accessError;

    const chatStatement: ChatStatement = {
      id: statement.id,
      tenantId: statement.tenant_id,
      caseId: statement.case_id,
      title: statement.title,
      witnessName: statement.witness_name,
      witnessEmail: statement.witness_email,
      contactPhone: statement.contact_phone ?? null,
    };
    return NextResponse.json(await touchWitnessPresence(chatStatement));
  } catch (error) {
    return handleApiError(error);
  }
}
