import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { previewFirmAds } from "@/lib/leads/acquisition/campaigns";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("acquisition-preview");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(tenant?.plan)) {
      return conflict("Running campaigns is part of Growth.");
    }
    const body = (await request.json().catch(() => null)) as { places?: string } | null;
    return ok(await previewFirmAds(auth.tenantId, body?.places));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
