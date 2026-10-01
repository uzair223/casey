import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { widgetEnabled } from "@/lib/billing/plans";
import { googleConfigured, googleStartUrl } from "@/lib/leads/acquisition/google";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { signOAuthState } from "@/lib/leads/acquisition/oauth";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    if (!googleConfigured()) {
      return conflict("Google Ads is not configured on this Casey workspace.");
    }
    const supabase = getServiceClient("google-ads-growth");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Connecting Google Ads is part of Growth.");
    return ok({
      url: googleStartUrl(signOAuthState({ tenantId: auth.tenantId, provider: "google" })).toString(),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
