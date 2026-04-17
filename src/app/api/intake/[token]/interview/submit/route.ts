import { NextResponse } from "next/server";
import { SERVERONLY_getStatementSubmissionNotificationRecipients } from "@/lib/supabase/queries";
import {
  SERVERONLY_submitStatement,
  SERVERONLY_updateStatementByToken,
} from "@/lib/supabase/mutations";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { sendStatementSubmittedNotificationEmail } from "@/lib/email";
import { StatementSubmission } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const body = (await request.json()) as StatementSubmission;

    if (!body?.signedDocument) {
      return NextResponse.json(
        { error: "signedDocument is required" },
        { status: 400 },
      );
    }

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const statementId = await SERVERONLY_submitStatement(token, body);

    try {
      const recipients =
        await SERVERONLY_getStatementSubmissionNotificationRecipients(
          statementId,
        );

      await sendStatementSubmittedNotificationEmail({
        to: recipients.recipientEmails,
        tenantName: recipients.tenantName,
        caseTitle: recipients.statementTitle,
        witnessName: recipients.witnessName,
      });
    } catch (notifyError) {
      console.error(
        "Failed to send statement submission notification:",
        notifyError,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit statement";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { witnessDetails } = (await request.json()) as {
      witnessDetails?: Record<string, string | null>;
    };

    if (!witnessDetails || Object.keys(witnessDetails).length === 0) {
      return NextResponse.json("ok");
    }

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    await SERVERONLY_updateStatementByToken(token, {
      witness_metadata: witnessDetails,
    });
    return NextResponse.json("ok");
  } catch (error) {
    console.error("Patch error:", error);
    return NextResponse.json("Failed to patch", { status: 500 });
  }
}
