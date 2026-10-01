import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadCreativeDraft, setCreativeClaimPaused } from "@/lib/leads/acquisition/campaigns";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("creative-pause");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Running campaigns is part of Growth.");
    const body = (await request.json().catch(() => null)) as { claim?: string; paused?: boolean } | null;
    if (!body?.claim || typeof body.paused !== "boolean") return conflict("Choose a lead type.");
    await setCreativeClaimPaused(auth.tenantId, body.claim, body.paused);
    return ok(await loadCreativeDraft(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
