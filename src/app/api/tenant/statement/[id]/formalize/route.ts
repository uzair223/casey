import { randomUUID } from "node:crypto";

import { ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { enqueueStatementFormalization } from "@/lib/leads/formalize";
import { getServiceClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireTenantManager(request);
    const { id } = await params;
    const supabase = getServiceClient("tenant-statement-formalize");
    const { data: statement, error } = await supabase
      .from("statements")
      .select("lead_stage")
      .eq("id", id)
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (
      statement?.lead_stage === "new" ||
      statement?.lead_stage === "declined"
    ) {
      return Response.json(
        { error: "The firm has not accepted this account yet." },
        { status: 409 },
      );
    }
    const result = await enqueueStatementFormalization({
      statementId: id,
      tenantId: auth.tenantId,
      requestId: request.headers.get("x-request-id") ?? randomUUID(),
    });
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return ok({ job: result.job });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
