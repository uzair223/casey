import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(
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

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    const snapshot = statement.template_document_snapshot;
    if (!snapshot?.bucketId || !snapshot.path) {
      return NextResponse.json(
        { error: "Template document not available" },
        { status: 404 },
      );
    }

    const supabase = getServiceClient("GET intake template document");
    const { data, error } = await supabase.storage
      .from(snapshot.bucketId)
      .download(snapshot.path);

    if (error || !data) {
      return NextResponse.json(
        { error: "Template document not available" },
        { status: 404 },
      );
    }

    const filename = (snapshot.name || "template.docx").replace(/"/g, "");

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": snapshot.type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Template document download error:", error);
    return NextResponse.json(
      { error: "Failed to load template document" },
      { status: 500 },
    );
  }
}
