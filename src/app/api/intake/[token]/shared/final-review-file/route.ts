import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";
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
    if (kind === "signed") {
      file = fullStatement.statement.signed_document as UploadedDocument | null;
    } else if (kind === "template") {
      file = fullStatement.statement.template_document_snapshot ?? null;
    } else if (kind === "supporting") {
      file = getSupportingDocument(
        fullStatement.statement.supporting_documents,
        url.searchParams.get("index"),
      );
    } else {
      return NextResponse.json(
        { error: "Invalid file kind. Use kind=signed, kind=template, or kind=supporting." },
        { status: 400 },
      );
    }

    if (!file?.path) {
      return NextResponse.json(
        { error: "Requested file not available" },
        { status: 404 },
      );
    }

    const resolvedFile = file;
    const bucketId = resolvedFile.bucketId ?? fullStatement.tenant_id;
    const data = await downloadStorageDocument({
      supabase,
      bucketId,
      path: resolvedFile.path,
    });

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
