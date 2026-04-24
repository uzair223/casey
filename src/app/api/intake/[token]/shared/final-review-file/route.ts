import { NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";
import type { UploadedDocument } from "@/types";

function sanitizeFilename(value: string) {
  return value.replace(/"/g, "");
}

function getSupportingDocument(
  documents: UploadedDocument[] | unknown,
  indexRaw: string | null,
): UploadedDocument | null {
  const index = Number.parseInt(indexRaw ?? "", 10);
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  if (!Array.isArray(documents)) {
    return null;
  }

  return (documents as UploadedDocument[])[index] ?? null;
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

    let file: UploadedDocument | null = null;
    if (kind === "signed") {
      file = fullStatement.statement.signed_document as UploadedDocument | null;
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

    if (!file?.path) {
      return NextResponse.json(
        { error: "Requested file not available" },
        { status: 404 },
      );
    }

    const bucketId = file.bucketId ?? fullStatement.tenant_id;
    const supabase = getServiceClient("GET intake final review file");
    const { data, error } = await supabase.storage
      .from(bucketId)
      .download(file.path);

    if (error || !data) {
      return NextResponse.json(
        { error: "Requested file not available" },
        { status: 404 },
      );
    }

    const filename = sanitizeFilename(file.name || "final-review-file");

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
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
