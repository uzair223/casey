import { ok, requireTenantUser, serverError } from "@/lib/api-utils";
import { getLeadUsageForTenant } from "@/lib/billing/lead-usage";

export async function GET(request: Request) {
  try {
    const auth = await requireTenantUser(request);
    const usage = await getLeadUsageForTenant(auth.tenantId);
    return ok(usage);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
