import { badRequest, conflict, ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { webhookUrlError } from "@/lib/leads/acquisition/push-result";
import { deleteCrmConnection, saveCrmConnection } from "@/lib/leads/acquisition/store";
import { ProviderError } from "@/lib/leads/acquisition/http";

export async function POST(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    const body = (await request.json().catch(() => null)) as { url?: string } | null;
    const url = body?.url?.trim() ?? "";
    const invalid = webhookUrlError(url);
    if (invalid) return badRequest(invalid);
    await saveCrmConnection({
      tenantId: auth.tenantId,
      provider: "webhook",
      webhookUrl: url,
    });
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    await deleteCrmConnection(auth.tenantId, "webhook");
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
