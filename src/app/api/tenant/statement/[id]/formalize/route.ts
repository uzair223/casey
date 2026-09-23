import { randomUUID } from "node:crypto";

import { ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { enqueueStatementFormalization } from "@/lib/leads/formalize";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireTenantManager(request);
    const { id } = await params;
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
