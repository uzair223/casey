import { ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { deleteAdAccount } from "@/lib/leads/acquisition/store";

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    await deleteAdAccount(auth.tenantId, "google");
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
