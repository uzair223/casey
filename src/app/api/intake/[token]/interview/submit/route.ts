import { NextResponse } from "next/server";
import { SERVERONLY_getStatementSubmissionNotificationRecipients } from "@/lib/supabase/queries";
import {
  SERVERONLY_submitStatement,
  SERVERONLY_createUserNotifications,
  SERVERONLY_updateStatementByToken,
} from "@/lib/supabase/mutations";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { handleApiError, validationError } from "@/lib/api-utils";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { sendStatementSubmittedNotificationEmail } from "@/lib/email";
import { StatementSubmission, UploadedDocument } from "@/types";
import { getServiceClient } from "@/lib/supabase/server";
import { getEvidenceDocuments } from "@/lib/evidence";
import { generateMissingStatementDocumentDescriptors } from "@/lib/ai-workers/document-descriptors";
import { applyProgrammaticEvidenceSection } from "@/lib/statement-utils";

function getSubmittedPathPrefix(statement: { case_id: string; id: string }) {
  return `cases/${statement.case_id}/${statement.id}/submitted/`;
}

function documentBelongsToStatement(
  document: UploadedDocument | null | undefined,
  statement: { tenant_id: string; case_id: string; id: string },
) {
  return (
    !!document?.path &&
    (document.bucketId ?? statement.tenant_id) === statement.tenant_id &&
    document.path.startsWith(getSubmittedPathPrefix(statement))
  );
}

function getValidatedSupportingDocuments(
  submitted: UploadedDocument[] | undefined,
  existingDocuments: UploadedDocument[],
  statement: { tenant_id: string; case_id: string; id: string },
) {
  if (!submitted || submitted.length === 0) {
    return null;
  }

  const existingByPath = new Map(
    existingDocuments.map((document) => [document.path, document]),
  );

  const validated: UploadedDocument[] = [];
  for (const document of submitted) {
    const existing = existingByPath.get(document.path);
    if (!existing || !documentBelongsToStatement(existing, statement)) {
      throw validationError("Invalid supporting document reference.");
    }

    validated.push(existing);
  }

  return validated;
}

async function describeEvidenceDocuments(token: string) {
  const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
  if (!statement) {
    throw new Error("Link not available");
  }

  const existingRows = statement.supporting_documents;
  const existing = getEvidenceDocuments(existingRows.map((row) => row.document));

  if (existing.length === 0) {
    return [];
  }

  await generateMissingStatementDocumentDescriptors({
    tenantId: statement.tenant_id,
    documents: existingRows,
    source: "witness",
  });

  return existing;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
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

    const contentType = request.headers.get("content-type") || "";
    let sections: StatementSubmission["sections"];
    let submittedSupportingDocuments: UploadedDocument[] | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const sectionsRaw = formData.get("sections");

      if (typeof sectionsRaw === "string" && sectionsRaw.trim()) {
        try {
          sections = JSON.parse(sectionsRaw) as StatementSubmission["sections"];
        } catch (error) {
          throw validationError("sections must be valid JSON.", {
            cause: error,
          });
        }
      }
    } else {
      const body = (await request.json()) as StatementSubmission & {
        supportingDocuments?: UploadedDocument[];
      };
      sections = body.sections;
      submittedSupportingDocuments = body.supportingDocuments;
    }

    const existingEvidenceDocuments = getEvidenceDocuments(
      statement.supporting_documents.map((row) => row.document),
    );
    getValidatedSupportingDocuments(
      submittedSupportingDocuments,
      existingEvidenceDocuments,
      statement,
    );

    await describeEvidenceDocuments(token);
    const statementWithDescriptors =
      await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statementWithDescriptors) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    if (sections) {
      sections = applyProgrammaticEvidenceSection(sections, {
        config: statementWithDescriptors.statement_config,
        rows: statementWithDescriptors.supporting_documents,
        witnessName: statementWithDescriptors.witness_name || "Witness",
      }) as StatementSubmission["sections"];
    }

    const statementId = await SERVERONLY_submitStatement(token, {
      sections,
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
    return handleApiError(error);
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
    return handleApiError(error);
  }
}
