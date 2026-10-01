import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { refreshSpend } from "@/lib/leads/acquisition/campaigns";
import { ProviderError } from "@/lib/leads/acquisition/http";

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const errors = await refreshSpend(auth.tenantId);
    const board = await loadAcquisitionBoard(auth.tenantId);
    if (errors.length) return conflict(errors.join(" "));
    return ok(board);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
