import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { readPublicWebsite } from "@/lib/leads/acquisition/site-fetch";
import { loadAdTargeting, saveAdTargeting } from "@/lib/leads/acquisition/targeting";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("ad-site");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Running campaigns is part of Growth.");
    const body = (await request.json().catch(() => null)) as { url?: string } | null;
    const brief = await readPublicWebsite(body?.url ?? "");
    const current = await loadAdTargeting(auth.tenantId);
    await saveAdTargeting(auth.tenantId, {
      ...current,
      websiteUrl: body?.url?.trim() ?? current.websiteUrl,
      siteSummary: brief.summary,
      sitePlaces: brief.places,
      siteClaims: brief.claims,
    });
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
