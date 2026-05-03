import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";
import { generateDoc } from "@/lib/doc-gen";
import type { StatementSupportingDocument, UploadedDocument } from "@/types";

function sanitizeFilename(value: string) {
  return value.replace(/"/g, "");
}

function getSupportingDocument(
  documents: StatementSupportingDocument[] | unknown,
  indexRaw: string | null,
): UploadedDocument | null {
  const index = Number.parseInt(indexRaw ?? "", 10);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  if (!Array.isArray(documents)) {
    return null;
  }

  return (documents as StatementSupportingDocument[])[index]?.document ?? null;
}

async function downloadStorageDocument(params: {
  supabase: ReturnType<typeof getServiceClient>;
  bucketId: string;
  path: string;
}) {
  const { data, error } = await params.supabase.storage
    .from(params.bucketId)
    .download(params.path);

  if (error || !data) {
    throw error ?? new Error("Requested file not available");
  }

  return data;
}

function getStatementDocumentName(fullStatement: {
  case: { title: string };
  statement: { witness_name: string };
}) {
  return `${fullStatement.case.title || "case"} ${fullStatement.statement.witness_name} Witness Statement.docx`;
}

async function renderUnsignedStatementDocument(params: {
  fullStatement: NonNullable<
    Awaited<ReturnType<typeof SERVERONLY_getFullStatementFromToken>>
  >;
  supabase: ReturnType<typeof getServiceClient>;
}) {
  const templateDocument = params.fullStatement.statement
    .template_document_snapshot
    ? await downloadStorageDocument({
        supabase: params.supabase,
        bucketId:
          params.fullStatement.statement.template_document_snapshot.bucketId ??
          params.fullStatement.tenant_id,
        path: params.fullStatement.statement.template_document_snapshot.path,
      })
    : null;

  return generateDoc(
    {
      caseMetadata:
        (params.fullStatement.case.case_metadata as Record<
          string,
          string | number | null | undefined
        >) ?? {},
      witnessName: params.fullStatement.statement.witness_name,
      witnessEmail: params.fullStatement.statement.witness_email,
      witnessMetadata:
        (params.fullStatement.statement.witness_metadata as Record<
          string,
          string | number | null | undefined
        >) ?? {},
      sections: params.fullStatement.statement.sections,
      config: params.fullStatement.statement.statement_config,
    },
    templateDocument,
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const fullStatement = await SERVERONLY_getFullStatementFromToken(
      token,
      false,
    );

    if (!fullStatement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      fullStatement.statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");

    const supabase = getServiceClient("GET intake final review file");
    let file: UploadedDocument | null = null;
    let generatedFile: Blob | null = null;
    if (kind === "signed") {
      file = fullStatement.statement.signed_document as UploadedDocument | null;
      if (!file?.path) {
        generatedFile = await renderUnsignedStatementDocument({
          fullStatement,
          supabase,
        });
        file = {
          name: getStatementDocumentName(fullStatement),
          path: "",
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          uploadedAt: new Date().toISOString(),
        };
      }
    } else if (kind === "supporting") {
      file = getSupportingDocument(
        fullStatement.statement.supporting_documents,
        url.searchParams.get("index"),
      );
    } else {
      return NextResponse.json(
        { error: "Invalid file kind. Use kind=signed or kind=supporting." },
        { status: 400 },
      );
    }

    if (!file?.path && !generatedFile) {
      return NextResponse.json(
        { error: "Requested file not available" },
        { status: 404 },
      );
    }

    const resolvedFile = file;
    if (!resolvedFile) {
      return NextResponse.json(
        { error: "Requested file not available" },
        { status: 404 },
      );
    }

    const bucketId = resolvedFile.bucketId ?? fullStatement.tenant_id;
    const data =
      generatedFile ??
      (await downloadStorageDocument({
        supabase,
        bucketId,
        path: resolvedFile.path,
      }));

    const filename = sanitizeFilename(resolvedFile.name || "final-review-file");

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": resolvedFile.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Final review file download error:", error);
    return NextResponse.json(
      { error: "Failed to load final review file" },
      { status: 500 },
    );
  }
}
