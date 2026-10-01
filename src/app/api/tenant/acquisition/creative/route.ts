import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadCreativeDraft, saveCreativeDraft } from "@/lib/leads/acquisition/campaigns";
import type { ApprovedAd } from "@/lib/leads/acquisition/creative";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

async function growth(request: Request) {
  const auth = await requireAdsManager(request);
  const supabase = getServiceClient("creative-studio");
  const { data, error } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", auth.tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!widgetEnabled(data?.plan)) throw new ProviderError("Running campaigns is part of Growth.");
  return auth;
}

export async function GET(request: Request) {
  try {
    const auth = await growth(request);
    return ok(await loadCreativeDraft(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await growth(request);
    const body = (await request.json().catch(() => null)) as { ads?: ApprovedAd[] } | null;
    if (!Array.isArray(body?.ads)) return conflict("Save the ads before leaving.");
    await saveCreativeDraft(auth.tenantId, body.ads);
    return ok(await loadCreativeDraft(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
