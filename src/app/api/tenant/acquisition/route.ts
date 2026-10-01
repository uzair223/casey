import { conflict, ok, requireTenantUser, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { ProviderError } from "@/lib/leads/acquisition/http";

export async function GET(request: Request) {
  try {
    const auth = await requireTenantUser(request);
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
