import "server-only";

import { env } from "@/lib/env";
import { campaignDestination, metaGeo, type FirmAd } from "./creative";
import { postForm, providerJson, ProviderError } from "./http";
import { oauthRedirect } from "./oauth";
import { asRecord, textField, type AdAccountRow } from "./store";

const GRAPH = "https://graph.facebook.com/v25.0";

export function metaConfigured() {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET);
}

export function metaStartUrl(state: string) {
  const url = new URL(`${GRAPH.replace("graph.facebook.com", "www.facebook.com")}/dialog/oauth`);
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("redirect_uri", oauthRedirect("meta"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "ads_management,ads_read,pages_show_list,pages_read_engagement");
  url.searchParams.set("state", state);
  return url;
}

async function longLivedToken(token: string) {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", token);
  const response = await fetch(url);
  return providerJson<{ access_token?: string; expires_in?: number }>(response);
}

export async function exchangeMetaCode(code: string) {
  const short = await postForm(`${GRAPH}/oauth/access_token`, {
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: oauthRedirect("meta"),
    code,
  });
  if (!short.access_token) throw new ProviderError("Meta did not return an access token.");
  const long = await longLivedToken(short.access_token);
  return {
    access_token: long.access_token || short.access_token,
    expires_in: long.expires_in ?? short.expires_in,
  };
}

async function metaGet<T>(path: string, accessToken: string) {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", accessToken);
  return providerJson<T>(await fetch(url));
}

async function metaPost<T>(path: string, accessToken: string, body: Record<string, unknown>) {
  const response = await fetch(`${GRAPH}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: accessToken }),
  });
  return providerJson<T>(response);
}

export async function chooseMetaAccount(accessToken: string) {
  const accounts = await metaGet<{
    data?: Array<{ id?: string; currency?: string; account_status?: number; name?: string }>;
  }>("me/adaccounts?fields=id,name,currency,account_status", accessToken);
  const account = (accounts.data ?? []).find(
    (row) => row.currency === "GBP" && row.account_status === 1 && row.id,
  );
  if (!account?.id) {
    throw new ProviderError(
      "Connect a Meta ad account that bills in pounds. Casey sets the budget in pounds.",
    );
  }
  const pages = await metaGet<{ data?: Array<{ id?: string; name?: string }> }>(
    "me/accounts?fields=id,name",
    accessToken,
  );
  const page = pages.data?.find((row) => row.id);
  return {
    adAccountId: account.id,
    pageId: page?.id ?? null,
    pageName: page?.name ?? null,
    currency: "GBP",
  };
}

async function accessTokenFor(account: AdAccountRow) {
  if (!account.access_token) throw new ProviderError("Reconnect Meta.");
  if (account.expires_at && new Date(account.expires_at).getTime() < Date.now()) {
    throw new ProviderError("Meta needs to be connected again.");
  }
  return account.access_token;
}

export async function resolveMetaPlaces(account: AdAccountRow, places: string[]) {
  if (!places.length) return { places: [] as Array<{ key: string; city: boolean }>, missed: [] as string[] };
  const token = await accessTokenFor(account);
  const matched: Array<{ key: string; city: boolean }> = [];
  const missed: string[] = [];
  for (const place of places) {
    try {
      const found = await metaGet<{
        data?: Array<{ key?: string; type?: string; country_code?: string }>;
      }>(
        `search?type=adgeolocation&q=${encodeURIComponent(place)}&location_types=["city","region"]&country_code=GB`,
        token,
      );
      const row = found.data?.find((item) => item.key && item.country_code === "GB");
      if (!row?.key) {
        missed.push(place);
        continue;
      }
      matched.push({ key: row.key, city: row.type === "city" });
    } catch {
      missed.push(place);
    }
  }
  return { places: matched, missed };
}

async function uploadMetaImage(accountId: string, token: string, png: Buffer) {
  const uploaded = await metaPost<{ images?: Record<string, { hash?: string }> }>(
    `${accountId}/adimages`,
    token,
    { bytes: png.toString("base64") },
  );
  const hash = Object.values(uploaded.images ?? {}).find((image) => image.hash)?.hash;
  if (!hash) throw new ProviderError("Meta did not accept the ad image.");
  return hash;
}

export async function createMetaTrafficCampaign(params: {
  account: AdAccountRow;
  baseUrl: string;
  dailyPence: number;
  ads: FirmAd[];
  images: Buffer[];
  places: Array<{ key: string; city: boolean }>;
}) {
  const token = await accessTokenFor(params.account);
  const details = asRecord(params.account.details);
  const accountId = params.account.external_account_id ?? "";
  const pageId = textField(details.pageId);
  if (!pageId) {
    throw new ProviderError(
      "Casey needs a Facebook Page on this account before it can run the Meta campaign.",
    );
  }
  const campaign = await metaPost<{ id?: string }>(`${accountId}/campaigns`, token, {
    name: `Casey traffic ${Date.now()}`,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  });
  if (!campaign.id) throw new ProviderError("Meta did not return the campaign.");
  const adSet = await metaPost<{ id?: string }>(`${accountId}/adsets`, token, {
    name: "Casey enquiry",
    campaign_id: campaign.id,
    daily_budget: params.dailyPence,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: metaGeo(params.places),
    status: "PAUSED",
    promoted_object: { page_id: pageId },
  });
  if (!adSet.id) throw new ProviderError("Meta did not return the ad set.");
  const adIds: string[] = [];
  for (const [index, ad] of params.ads.entries()) {
    const hash = await uploadMetaImage(accountId, token, params.images[index] ?? params.images[0]);
    const creative = await metaPost<{ id?: string }>(`${accountId}/adcreatives`, token, {
      name: ad.claim,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          link: campaignDestination(params.baseUrl, "meta", ad.claim),
          message: ad.descriptions[0],
          name: ad.headlines[1] || ad.headlines[0],
          image_hash: hash,
          call_to_action: { type: "LEARN_MORE" },
        },
      },
    });
    if (!creative.id) throw new ProviderError("Meta did not return the ad.");
    const created = await metaPost<{ id?: string }>(`${accountId}/ads`, token, {
      name: ad.claim,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });
    if (created.id) adIds.push(created.id);
  }
  return { campaignId: campaign.id, adSetId: adSet.id, adIds };
}

export async function setMetaBudget(account: AdAccountRow, adSetId: string, dailyPence: number) {
  const token = await accessTokenFor(account);
  await metaPost(adSetId, token, { daily_budget: dailyPence });
}

export async function setMetaCampaignStatus(
  account: AdAccountRow,
  ids: string[],
  status: "ACTIVE" | "PAUSED",
) {
  const token = await accessTokenFor(account);
  for (const id of ids) {
    await metaPost(id, token, { status });
  }
}

export async function refreshMetaSpend(account: AdAccountRow, campaignId: string | null) {
  if (!campaignId) return { clicks: {} as Record<string, { minor: number; currency: string }>, spendMinor: 0 };
  const token = await accessTokenFor(account);
  const insights = await metaGet<{
    data?: Array<{
      spend?: string;
      inline_link_clicks?: string;
      cost_per_inline_link_click?: string;
    }>;
  }>(
    `${campaignId}/insights?fields=spend,inline_link_clicks,cost_per_inline_link_click&date_preset=last_30d`,
    token,
  );
  const row = insights.data?.[0];
  const spend = Number(row?.spend ?? 0);
  const clickCost = Number(row?.cost_per_inline_link_click ?? 0);
  const clicks: Record<string, { minor: number; currency: string }> = {};
  if (Number.isFinite(clickCost) && clickCost > 0) {
    clicks["campaign:casey-meta"] = { minor: Math.round(clickCost * 100), currency: "GBP" };
  }
  return {
    clicks,
    spendMinor: Number.isFinite(spend) ? Math.round(spend * 100) : 0,
  };
}
