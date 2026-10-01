import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadCreativeDraft } from "@/lib/leads/acquisition/campaigns";
import { dailyBudgetPence } from "@/lib/leads/acquisition/copy";
import { buildFirmAds } from "@/lib/leads/acquisition/creative";
import { forecastGoogleCampaign, resolveGooglePlaces } from "@/lib/leads/acquisition/google";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { estimateMetaDelivery, resolveMetaPlaces } from "@/lib/leads/acquisition/meta";
import { listAdAccounts } from "@/lib/leads/acquisition/store";
import { readGoogleForecast, readMetaDeliveryEstimate } from "@/lib/leads/acquisition/studio";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("ad-forecast");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Running campaigns is part of Growth.");
    const body = (await request.json().catch(() => null)) as { monthlyBudgetGbp?: number } | null;
    const monthly = Number(body?.monthlyBudgetGbp);
    const budget = Number.isInteger(monthly) ? monthly : 30;
    const draft = await loadCreativeDraft(auth.tenantId);
    const accounts = await listAdAccounts(auth.tenantId);
    const google = accounts.find((account) => account.provider === "google" && account.access_token) ?? null;
    const meta = accounts.find((account) => account.provider === "meta" && account.access_token) ?? null;
    const keywords = buildFirmAds({
      firmName: "The firm",
      claims: draft.ads.map((ad) => ad.claim),
      places: draft.places,
    }).flatMap((ad) => ad.keywords);
    let googleEstimate: ReturnType<typeof readGoogleForecast> = null;
    let metaEstimate: ReturnType<typeof readMetaDeliveryEstimate> = null;
    let googleNote: string | null = google ? null : "Connect Google Ads to see an estimate.";
    let metaNote: string | null = meta ? null : "Connect Meta to see an estimate.";
    if (google) {
      try {
        const places = await resolveGooglePlaces(google, draft.places);
        googleEstimate = readGoogleForecast(
          await forecastGoogleCampaign({ account: google, keywords, geoIds: places.ids }),
        );
        if (!googleEstimate) googleNote = "Google did not return an estimate.";
      } catch (forecastError) {
        googleNote = forecastError instanceof Error ? forecastError.message : "Google did not return an estimate.";
      }
    }
    if (meta) {
      try {
        const places = await resolveMetaPlaces(meta, draft.places);
        const daily = dailyBudgetPence(budget);
        metaEstimate = readMetaDeliveryEstimate(
          await estimateMetaDelivery({ account: meta, dailyPence: daily, places: places.places }),
          daily,
        );
        if (!metaEstimate) metaNote = "Meta did not return an estimate.";
      } catch (forecastError) {
        metaNote = forecastError instanceof Error ? forecastError.message : "Meta did not return an estimate.";
      }
    }
    return ok({ google: googleEstimate, meta: metaEstimate, googleNote, metaNote });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
