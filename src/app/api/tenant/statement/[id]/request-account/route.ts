import { ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { requestSupportingAccount } from "@/lib/leads/supporting";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireTenantManager(request);
    const { id } = await params;
    const result = await requestSupportingAccount({
      statementId: id,
      tenantId: auth.tenantId,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
