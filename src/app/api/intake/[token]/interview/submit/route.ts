import { NextResponse } from "next/server";
import { SERVERONLY_getStatementSubmissionNotificationRecipients } from "@/lib/supabase/queries";
import {
  SERVERONLY_submitStatement,
  SERVERONLY_createUserNotifications,
  SERVERONLY_updateStatementByToken,
} from "@/lib/supabase/mutations";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { sendStatementSubmittedNotificationEmail } from "@/lib/email";
import { StatementSubmission } from "@/types";
import { getServiceClient } from "@/lib/supabase/server";
import {
  createEvidenceExhibits,
  getEvidenceDocuments,
} from "@/lib/intake-evidence";

async function describeEvidenceExhibits(token: string) {
  const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
  if (!statement) {
    throw new Error("Link not available");
  }

  const existing = getEvidenceDocuments(statement.supporting_documents);

  if (existing.length === 0) {
    return [];
  }

  const exhibits = createEvidenceExhibits(
    existing,
    statement.witness_name || "Witness",
  );
  const nextDocuments = [];

  for (const exhibit of exhibits) {
    for (const document of exhibit.documents) {
      nextDocuments.push({
        ...document,
        description: `${exhibit.exhibit}. ${exhibit.description}`,
      });
    }
  }

  await SERVERONLY_updateStatementByToken(token, {
    supporting_documents: nextDocuments,
  });

  return nextDocuments;
}

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

    if (statement.status === "finalized" || statement.status === "completed") {
      return NextResponse.json(
        { error: "This statement has moved to final review." },
        { status: 409 },
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

    const supportingDocuments =
      body.supportingDocuments && body.supportingDocuments.length > 0
        ? body.supportingDocuments
        : await describeEvidenceExhibits(token);

    const statementId = await SERVERONLY_submitStatement(token, {
      ...body,
      supportingDocuments,
    });

    try {
      const recipients =
        await SERVERONLY_getStatementSubmissionNotificationRecipients(
          statementId,
        );

      const supabase = getServiceClient(
        "intake_submit_statement_notifications",
      );
      const { data: preferences } = await supabase
        .from("tenant_notification_preferences")
        .select("submissions_channel")
        .eq("tenant_id", recipients.tenantId)
        .maybeSingle();

      const submissionsChannel = preferences?.submissions_channel ?? "in_app";

      await SERVERONLY_createUserNotifications({
        tenantId: recipients.tenantId,
        recipientUserIds: recipients.recipientUserIds,
        notificationType: "statement_submitted_for_review",
        entityType: "statement",
        entityId: recipients.statementId,
        title: "Statement submitted for review",
        body: `${recipients.witnessName || "A witness"} submitted a statement for review in ${recipients.statementTitle}.`,
        linkPath: `/cases/${recipients.caseId}?statement=${recipients.statementId}`,
        metadata: {
          witnessName: recipients.witnessName,
          caseTitle: recipients.statementTitle,
        },
      });

      if (submissionsChannel === "email" || submissionsChannel === "both") {
        await sendStatementSubmittedNotificationEmail({
          to: recipients.recipientEmails,
          tenantName: recipients.tenantName,
          caseTitle: recipients.statementTitle,
          witnessName: recipients.witnessName,
        });
      }
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

    if (statement.status === "finalized" || statement.status === "completed") {
      return NextResponse.json(
        { error: "This statement is read-only in final review." },
        { status: 409 },
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
