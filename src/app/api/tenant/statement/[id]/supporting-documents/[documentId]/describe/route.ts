import { NextResponse } from "next/server";

import { paidAiDenial } from "@/lib/billing/paid-plan";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { handleApiError } from "@/lib/api-utils";
import { generateStatementDocumentDescriptor } from "@/lib/ai-workers/document-descriptors";
import { getStatementSupportingDocumentsWithClient } from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; documentId: string }> },
) {
  try {
    const { id: statementId, documentId } = await params;
    const auth = await requireTenantUser(request);
    const denied = await paidAiDenial({
      role: auth.role,
      tenantId: auth.tenantId,
    });
    if (denied) return denied;

    const service = getServiceClient("tenant-document-describe");
    const { data: statement, error: statementError } = await service
      .from("statements")
      .select("lead_stage")
      .eq("id", statementId)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (statementError) throw statementError;
    if (
      statement?.lead_stage === "new" ||
      statement?.lead_stage === "declined"
    ) {
      return NextResponse.json(
        { error: "The firm has not accepted this account yet." },
        { status: 409 },
      );
    }

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
