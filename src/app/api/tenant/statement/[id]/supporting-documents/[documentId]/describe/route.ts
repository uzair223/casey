import { NextResponse } from "next/server";

import { requireTenantUser } from "@/lib/api-utils/auth";
import { handleApiError } from "@/lib/api-utils";
import { generateStatementDocumentDescriptor } from "@/lib/ai-workers/document-descriptors";
import { getStatementSupportingDocumentsWithClient } from "@/lib/supabase/queries";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const { id: statementId, documentId } = await params;
    const auth = await requireTenantUser(request);

    const documents = await getStatementSupportingDocumentsWithClient(
      auth.supabase,
      statementId,
    );
    const document = documents.find((row) => row.id === documentId);

    if (!document || document.tenant_id !== auth.tenantId) {
      return NextResponse.json(
        { error: "Supporting document not found" },
        { status: 404 },
      );
    }

    const descriptors = await generateStatementDocumentDescriptor({
      tenantId: auth.tenantId,
      documentRow: document,
    });

    return NextResponse.json({ descriptors });
  } catch (error) {
    return handleApiError(error);
  }
}
