import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { widgetEnabled } from "@/lib/billing/plans";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { metaConfigured, metaStartUrl } from "@/lib/leads/acquisition/meta";
import { signOAuthState } from "@/lib/leads/acquisition/oauth";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    if (!metaConfigured()) return conflict("Meta is not configured on this Casey workspace.");
    const supabase = getServiceClient("meta-ads-growth");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Connecting Meta is part of Growth.");
    return ok({
      url: metaStartUrl(signOAuthState({ tenantId: auth.tenantId, provider: "meta" })).toString(),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
