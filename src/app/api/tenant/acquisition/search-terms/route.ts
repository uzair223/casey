import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { blockGoogleSearchTerm, listGoogleSearchTerms } from "@/lib/leads/acquisition/google";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { listAdAccounts, listCampaigns } from "@/lib/leads/acquisition/store";
import { readSearchTerms } from "@/lib/leads/acquisition/studio";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

async function googleCampaign(tenantId: string) {
  const accounts = await listAdAccounts(tenantId);
  const campaigns = await listCampaigns(tenantId);
  const account = accounts.find((item) => item.provider === "google" && item.access_token) ?? null;
  const campaign = campaigns.find((item) => item.provider === "google" && item.external_campaign_id) ?? null;
  return { account, campaignId: campaign?.external_campaign_id ?? null };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("ad-search-terms");
    const { data, error } = await supabase.from("tenants").select("plan").eq("id", auth.tenantId).maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Running campaigns is part of Growth.");
    const { account, campaignId } = await googleCampaign(auth.tenantId);
    if (!account || !campaignId) return ok({ terms: [], note: "Connect Google Ads and run the campaign to see searches." });
    const terms = readSearchTerms(await listGoogleSearchTerms(account, campaignId));
    return ok({ terms, note: null });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("ad-search-block");
    const { data, error } = await supabase.from("tenants").select("plan").eq("id", auth.tenantId).maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Running campaigns is part of Growth.");
    const body = (await request.json().catch(() => null)) as { term?: string } | null;
    const { account, campaignId } = await googleCampaign(auth.tenantId);
    if (!account || !campaignId || !body?.term) return conflict("Run the Google campaign before blocking a search.");
    await blockGoogleSearchTerm(account, campaignId, body.term);
    return ok({ blocked: body.term });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
