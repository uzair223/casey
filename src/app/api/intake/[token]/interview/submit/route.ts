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
import { StatementSubmission, UploadedDocument } from "@/types";
import { getServiceClient } from "@/lib/supabase/server";
import {
  createEvidenceExhibits,
  getEvidenceDocuments,
} from "@/lib/intake-evidence";

const SIGNED_DOCUMENT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_SIGNED_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").trim() || "file";
}

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
      throw new Error("Invalid supporting document reference.");
    }

    validated.push(existing);
  }

  return validated;
}

async function uploadSignedDocument(params: {
  statement: { tenant_id: string; case_id: string; id: string; title: string; witness_name: string };
  file: File;
}) {
  if (params.file.size > MAX_SIGNED_DOCUMENT_SIZE_BYTES) {
    throw new Error("Signed statement exceeds the 25MB file size limit.");
  }

  const supabase = getServiceClient("intake_submit_signed_document_upload");
  const storage = supabase.storage.from(params.statement.tenant_id);
  const safeName = sanitizeFilename(
    params.file.name ||
      `${params.statement.title || "case"} ${params.statement.witness_name} Witness Statement.docx`,
  );
  const path = `${getSubmittedPathPrefix(params.statement)}${new Date().toISOString()} ${safeName}`;

  const { data, error } = await storage.upload(path, params.file, {
    contentType: params.file.type || SIGNED_DOCUMENT_CONTENT_TYPE,
    upsert: false,
  });

  if (error || !data) {
    throw error ?? new Error("Failed to upload signed statement.");
  }

  return {
    bucketId: params.statement.tenant_id,
    name: params.file.name || safeName,
    description: `${params.statement.witness_name}'s signed statement on ${new Date().toLocaleDateString()}`,
    path: data.path,
    uploadedAt: new Date().toISOString(),
    type: params.file.type || SIGNED_DOCUMENT_CONTENT_TYPE,
  } satisfies UploadedDocument;
}

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
    let signedDocument: UploadedDocument | null = null;
    let submittedSupportingDocuments: UploadedDocument[] | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const sectionsRaw = formData.get("sections");
      const signedDocumentFile = formData.get("signedDocument");

      if (typeof sectionsRaw === "string" && sectionsRaw.trim()) {
        sections = JSON.parse(sectionsRaw) as StatementSubmission["sections"];
      }

      if (!(signedDocumentFile instanceof File)) {
        return NextResponse.json(
          { error: "signedDocument file is required" },
          { status: 400 },
        );
      }

      signedDocument = await uploadSignedDocument({
        statement,
        file: signedDocumentFile,
      });
    } else {
      const body = (await request.json()) as StatementSubmission;
      sections = body.sections;
      submittedSupportingDocuments = body.supportingDocuments;
      signedDocument = body.signedDocument;

      if (!documentBelongsToStatement(signedDocument, statement)) {
        return NextResponse.json(
          { error: "Invalid signed document reference" },
          { status: 400 },
        );
      }
    }

    if (!signedDocument) {
      return NextResponse.json(
        { error: "signedDocument is required" },
        { status: 400 },
      );
    }

    const existingEvidenceDocuments = getEvidenceDocuments(
      statement.supporting_documents,
    );
    const validatedSupportingDocuments = getValidatedSupportingDocuments(
      submittedSupportingDocuments,
      existingEvidenceDocuments,
      statement,
    );

    const supportingDocuments =
      validatedSupportingDocuments && validatedSupportingDocuments.length > 0
        ? validatedSupportingDocuments
        : await describeEvidenceExhibits(token);

    const statementId = await SERVERONLY_submitStatement(token, {
      signedDocument,
      sections,
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
