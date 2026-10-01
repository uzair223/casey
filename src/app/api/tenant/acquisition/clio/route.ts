import { ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { deleteCrmConnection } from "@/lib/leads/acquisition/store";

export async function DELETE(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    await deleteCrmConnection(auth.tenantId, "clio");
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
