import { conflict, ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { clioConfigured, clioRegion, clioStartUrl } from "@/lib/leads/acquisition/clio";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { signOAuthState } from "@/lib/leads/acquisition/oauth";

export async function GET(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    if (!clioConfigured()) return conflict("Clio is not configured on this Casey workspace.");
    const region = clioRegion(new URL(request.url).searchParams.get("region"));
    return ok({
      url: clioStartUrl(
        signOAuthState({ tenantId: auth.tenantId, provider: "clio", region }),
        region,
      ).toString(),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
