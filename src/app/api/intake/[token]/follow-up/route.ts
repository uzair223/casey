import { NextResponse } from "next/server";

import {
  enforcePersistentRateLimit,
  handleApiError,
} from "@/lib/api-utils";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import {
  readChatForm,
  uploadWitnessChatFiles,
} from "@/lib/witness-chat/files";
import {
  loadWitnessChat,
  postWitnessChatMessage,
  type ChatStatement,
} from "@/lib/witness-chat/service";

function toChatStatement(statement: {
  id: string;
  tenant_id: string;
  case_id: string;
  title: string;
  witness_name: string;
  witness_email: string;
  contact_phone?: string | null;
}): ChatStatement {
  return {
    id: statement.id,
    tenantId: statement.tenant_id,
    caseId: statement.case_id,
    title: statement.title,
    witnessName: statement.witness_name,
    witnessEmail: statement.witness_email,
    contactPhone: statement.contact_phone ?? null,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "intake:witness-chat:get",
      identifier: token,
      limit: 240,
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

    const snapshot = await loadWitnessChat(
      toChatStatement(statement),
      "witness",
      null,
    );
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const rateLimitResponse = await enforcePersistentRateLimit({
      request,
      scope: "intake:witness-chat:post",
      identifier: token,
      limit: 180,
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
      "interact",
    );
    if (accessError) return accessError;

    const form = await readChatForm(request);
    const attachments = await uploadWitnessChatFiles({
      tenantId: statement.tenant_id,
      caseId: statement.case_id,
      statementId: statement.id,
      files: form.files,
    });
    const snapshot = await postWitnessChatMessage({
      statement: toChatStatement(statement),
      body: form.body,
      clientId: form.clientId,
      attachments,
      fileRequestId: form.fileRequestId,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleApiError(error);
  }
}
