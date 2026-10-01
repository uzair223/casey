import "server-only";

import { firmPageUrl } from "@/lib/firm-page-host";
import { readLeadBranding } from "@/lib/leads/logo";
import {
  DEFAULT_LEAD_HEADER_COLOR,
  DEFAULT_LEAD_TEXT_COLOR,
  leadHexColor,
} from "@/lib/leads/schema";
import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types";
import { dailyBudgetPence, MONTHLY_BUDGET_MAX_GBP, MONTHLY_BUDGET_MIN_GBP } from "./copy";
import { loadAdAssetBytes } from "./assets";
import {
  adFingerprint,
  buildFirmAds,
  readAdPlaces,
  readAdTargeting,
  type FirmAd,
} from "./creative";
import {
  createGoogleSearchCampaign,
  refreshGoogleSpend,
  resolveGooglePlaces,
  setGoogleBudget,
  setGoogleCampaignStatus,
} from "./google";
import { ProviderError } from "./http";
import { renderBrandAdPng } from "./media";
import { loadAdTargeting, saveAdTargeting } from "./targeting";
import {
  createMetaTrafficCampaign,
  refreshMetaSpend,
  resolveMetaPlaces,
  setMetaBudget,
  setMetaCampaignStatus,
} from "./meta";
import {
  asRecord,
  listAdAccounts,
  listCampaigns,
  saveCampaign,
  textField,
  updateAdAccount,
  type AdAccountRow,
  type CampaignRow,
} from "./store";

export function budgetError(value: number) {
  if (!Number.isInteger(value) || value < MONTHLY_BUDGET_MIN_GBP || value > MONTHLY_BUDGET_MAX_GBP) {
    return `Set a monthly budget from £${MONTHLY_BUDGET_MIN_GBP} to £${MONTHLY_BUDGET_MAX_GBP.toLocaleString("en-GB")}.`;
  }
  return null;
}

async function loadFirm(tenantId: string) {
  const supabase = getServiceClient("lead-ad-brief");
  const [{ data: tenant, error }, { data: channels, error: channelError }] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, public_slug, intake_branding, ad_targeting")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("lead_channels")
      .select("enabled, statement_config_templates!lead_channels_lead_type_id_fkey(name)")
      .eq("tenant_id", tenantId)
      .eq("enabled", true),
  ]);
  if (error || channelError) throw error ?? channelError;
  if (!tenant?.public_slug) {
    throw new ProviderError("Set the public address before running a campaign.");
  }
  const branding = readLeadBranding(tenant.intake_branding);
  const targeting = readAdTargeting(tenant.ad_targeting);
  const claims = (channels ?? []).flatMap((channel) => {
    const leadType = Array.isArray(channel.statement_config_templates)
      ? channel.statement_config_templates[0]
      : channel.statement_config_templates;
    return leadType?.name ? [leadType.name] : [];
  });
  return {
    firmName: branding.displayName?.trim() || tenant.name,
    baseUrl: firmPageUrl(tenant.public_slug),
    claims,
    places: targeting.places,
    assets: targeting.assets,
    voice: targeting.siteSummary,
    background: leadHexColor(branding.primaryColor, DEFAULT_LEAD_HEADER_COLOR),
    text: leadHexColor(branding.textColor, DEFAULT_LEAD_TEXT_COLOR),
  };
}

async function savePlaces(tenantId: string, places: string[]) {
  const current = await loadAdTargeting(tenantId);
  await saveAdTargeting(tenantId, { ...current, places });
}

async function campaignImages(
  tenantId: string,
  firm: Awaited<ReturnType<typeof loadFirm>>,
  ads: FirmAd[],
) {
  const uploaded = await loadAdAssetBytes(tenantId, firm.assets);
  if (uploaded.length) {
    return ads.map((_, index) => uploaded[index % uploaded.length]);
  }
  return ads.map((ad) =>
    renderBrandAdPng({
      firmName: firm.firmName,
      line: ad.imageLine,
      background: firm.background,
      text: firm.text,
    }),
  );
}

function placeWarning(missed: string[], usedCountryFallback: boolean) {
  if (!missed.length) return null;
  if (usedCountryFallback) {
    return `Casey could not match ${missed.join(", ")}, so these ads target the UK.`;
  }
  return `Casey could not match ${missed.join(", ")}. The other places are still targeted.`;
}

export async function previewFirmAds(tenantId: string, placesText?: string) {
  const firm = await loadFirm(tenantId);
  const places = typeof placesText === "string" ? readAdPlaces(placesText) : firm.places;
  const ads = buildFirmAds({
    firmName: firm.firmName,
    claims: firm.claims,
    places,
    voice: firm.voice,
  });
  return {
    places,
    ads: ads.map((ad) => ({
      claim: ad.claim,
      headlines: ad.headlines,
      descriptions: ad.descriptions,
      image: `data:image/png;base64,${renderBrandAdPng({
        firmName: firm.firmName,
        line: ad.imageLine,
        background: firm.background,
        text: firm.text,
        size: 640,
      }).toString("base64")}`,
    })),
  };
}

export async function runCampaigns(params: {
  tenantId: string;
  monthlyBudgetGbp: number;
  action: "run" | "pause" | "resume";
  places?: string;
}) {
  const invalid = budgetError(params.monthlyBudgetGbp);
  if (invalid) throw new ProviderError(invalid);
  if (typeof params.places === "string") {
    await savePlaces(params.tenantId, readAdPlaces(params.places));
  }
  const accounts = await listAdAccounts(params.tenantId);
  const google = accountFor(accounts, "google");
  const meta = accountFor(accounts, "meta");
  if (!google && !meta) {
    throw new ProviderError("Connect Google Ads or Meta before running a campaign.");
  }
  const campaigns = await listCampaigns(params.tenantId);
  const firm = await loadFirm(params.tenantId);
  const hasCampaign = campaigns.some((campaign) => campaign.external_campaign_id);
  if (!firm.claims.length && (params.action !== "pause" || !hasCampaign)) {
    throw new ProviderError("Turn on at least one lead type before Casey can write the ads.");
  }
  const ads = buildFirmAds({
    firmName: firm.firmName,
    claims: firm.claims,
    places: firm.places,
    voice: firm.voice,
  });
  const images = await campaignImages(params.tenantId, firm, ads);
  const fingerprint = adFingerprint({
    firmName: firm.firmName,
    claims: firm.claims,
    places: firm.places,
    background: firm.background,
    text: firm.text,
    destination: firm.baseUrl,
    voice: firm.voice,
    assetIds: firm.assets.map((asset) => asset.id),
  });
  const enabled = params.action !== "pause";
  const status = enabled ? "live" : "paused";
  const errors: string[] = [];

  if (google) {
    try {
      const startError = await applyGoogle({
        account: google,
        campaign: campaignFor(campaigns, "google"),
        tenantId: params.tenantId,
        firm,
        ads,
        fingerprint,
        images,
        monthlyBudgetGbp: params.monthlyBudgetGbp,
        enabled,
        status,
        rebuild: params.action !== "pause",
      });
      if (startError) errors.push(startError);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Ads did not update.";
      errors.push(message);
      await saveCampaign({
        tenantId: params.tenantId,
        provider: "google",
        externalCampaignId: campaignFor(campaigns, "google")?.external_campaign_id ?? null,
        status: campaignFor(campaigns, "google")?.status === "live" ? "live" : "paused",
        monthlyBudgetGbp: params.monthlyBudgetGbp,
        details: asRecord(campaignFor(campaigns, "google")?.details),
        lastError: message,
      });
    }
  }

  if (meta) {
    try {
      const startError = await applyMeta({
        account: meta,
        campaign: campaignFor(campaigns, "meta"),
        tenantId: params.tenantId,
        firm,
        ads,
        fingerprint,
        images,
        monthlyBudgetGbp: params.monthlyBudgetGbp,
        enabled,
        status,
        rebuild: params.action !== "pause",
      });
      if (startError) errors.push(startError);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta did not update.";
      errors.push(message);
      await saveCampaign({
        tenantId: params.tenantId,
        provider: "meta",
        externalCampaignId: campaignFor(campaigns, "meta")?.external_campaign_id ?? null,
        status: campaignFor(campaigns, "meta")?.status === "live" ? "live" : "paused",
        monthlyBudgetGbp: params.monthlyBudgetGbp,
        details: asRecord(campaignFor(campaigns, "meta")?.details),
        lastError: message,
      });
    }
  }

  return errors;
}

function accountFor(accounts: AdAccountRow[], provider: "google" | "meta") {
  return accounts.find((account) => account.provider === provider) ?? null;
}

function campaignFor(campaigns: CampaignRow[], provider: "google" | "meta") {
  return campaigns.find((campaign) => campaign.provider === provider) ?? null;
}

async function applyGoogle(params: {
  account: AdAccountRow;
  campaign: CampaignRow | null;
  tenantId: string;
  firm: Awaited<ReturnType<typeof loadFirm>>;
  ads: FirmAd[];
  fingerprint: string;
  images: Buffer[];
  monthlyBudgetGbp: number;
  enabled: boolean;
  status: "live" | "paused";
  rebuild: boolean;
}) {
  const dailyMicros = String(dailyBudgetPence(params.monthlyBudgetGbp) * 10_000);
  let campaignId = params.campaign?.external_campaign_id ?? null;
  let details = asRecord(params.campaign?.details);
  const previousFingerprint = textField(details.fingerprint);
  const shouldCreate =
    params.ads.length > 0 &&
    (!campaignId || (params.rebuild && previousFingerprint !== params.fingerprint));
  let startError: string | null = null;
  if (shouldCreate) {
    const places = await resolveGooglePlaces(params.account, params.firm.places);
    const image = params.images[0];
    const created = await createGoogleSearchCampaign({
      account: params.account,
      baseUrl: params.firm.baseUrl,
      dailyMicros,
      ads: params.ads,
      geoIds: places.ids,
      imagePng: image,
    });
    if (campaignId && campaignId !== created.campaignId) {
      await setGoogleCampaignStatus(params.account, campaignId, "PAUSED").catch(() => undefined);
    }
    campaignId = created.campaignId;
    details = {
      ...details,
      budgetResourceName: created.budgetResourceName,
      fingerprint: params.fingerprint,
      missedPlaces: places.missed,
    };
    if (params.enabled) {
      try {
        await setGoogleCampaignStatus(params.account, campaignId, "ENABLED");
      } catch (error) {
        startError =
          error instanceof Error ? error.message : "Google Ads did not start the campaign.";
      }
    }
  } else if (campaignId) {
    const budgetResourceName = textField(details.budgetResourceName);
    if (budgetResourceName) {
      await setGoogleBudget(params.account, budgetResourceName, dailyMicros);
    }
    await setGoogleCampaignStatus(
      params.account,
      campaignId,
      params.enabled ? "ENABLED" : "PAUSED",
    );
  }
  const missed = Array.isArray(details.missedPlaces)
    ? details.missedPlaces.filter((place): place is string => typeof place === "string")
    : [];
  const warning = placeWarning(missed, missed.length > 0 && params.firm.places.length === missed.length);
  await saveCampaign({
    tenantId: params.tenantId,
    provider: "google",
    externalCampaignId: campaignId,
    status: startError ? "paused" : params.status,
    monthlyBudgetGbp: params.monthlyBudgetGbp,
    details,
    lastError: startError ?? warning,
  });
  return startError;
}

async function applyMeta(params: {
  account: AdAccountRow;
  campaign: CampaignRow | null;
  tenantId: string;
  firm: Awaited<ReturnType<typeof loadFirm>>;
  ads: FirmAd[];
  fingerprint: string;
  images: Buffer[];
  monthlyBudgetGbp: number;
  enabled: boolean;
  status: "live" | "paused";
  rebuild: boolean;
}) {
  let campaignId = params.campaign?.external_campaign_id ?? null;
  let details = asRecord(params.campaign?.details);
  const previousFingerprint = textField(details.fingerprint);
  const shouldCreate =
    params.ads.length > 0 &&
    (!campaignId || (params.rebuild && previousFingerprint !== params.fingerprint));
  let startError: string | null = null;
  if (shouldCreate) {
    const places = await resolveMetaPlaces(params.account, params.firm.places);
    const images = params.images;
    const created = await createMetaTrafficCampaign({
      account: params.account,
      baseUrl: params.firm.baseUrl,
      dailyPence: dailyBudgetPence(params.monthlyBudgetGbp),
      ads: params.ads,
      images,
      places: places.places,
    });
    if (campaignId && campaignId !== created.campaignId) {
      await setMetaCampaignStatus(params.account, [campaignId], "PAUSED").catch(() => undefined);
    }
    campaignId = created.campaignId;
    details = {
      ...details,
      adSetId: created.adSetId,
      adIds: created.adIds,
      fingerprint: params.fingerprint,
      missedPlaces: places.missed,
    };
    if (params.enabled) {
      try {
        await setMetaCampaignStatus(
          params.account,
          [created.campaignId, created.adSetId, ...created.adIds],
          "ACTIVE",
        );
      } catch (error) {
        startError = error instanceof Error ? error.message : "Meta did not start the campaign.";
      }
    }
  } else if (campaignId) {
    const adSetId = textField(details.adSetId);
    if (adSetId) {
      await setMetaBudget(params.account, adSetId, dailyBudgetPence(params.monthlyBudgetGbp));
    }
    const adIds = Array.isArray(details.adIds)
      ? details.adIds.filter((id): id is string => typeof id === "string")
      : [];
    const ids = [campaignId, adSetId, textField(details.adId), ...adIds].filter(
      (id): id is string => Boolean(id),
    );
    await setMetaCampaignStatus(params.account, ids, params.enabled ? "ACTIVE" : "PAUSED");
  }
  const missed = Array.isArray(details.missedPlaces)
    ? details.missedPlaces.filter((place): place is string => typeof place === "string")
    : [];
  const warning = placeWarning(missed, missed.length > 0 && params.firm.places.length === missed.length);
  await saveCampaign({
    tenantId: params.tenantId,
    provider: "meta",
    externalCampaignId: campaignId,
    status: startError ? "paused" : params.status,
    monthlyBudgetGbp: params.monthlyBudgetGbp,
    details,
    lastError: startError ?? warning,
  });
  return startError;
}

export async function refreshSpend(tenantId: string) {
  const accounts = await listAdAccounts(tenantId);
  const campaigns = await listCampaigns(tenantId);
  const google = accountFor(accounts, "google");
  const meta = accountFor(accounts, "meta");
  const errors: string[] = [];
  if (google?.access_token) {
    try {
      const spend = await refreshGoogleSpend(google);
      await updateAdAccount(google.id, {
        spend_by_click: spend as Json,
        spend_refreshed_at: new Date().toISOString(),
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Google Ads spend did not load.");
    }
  }
  if (meta?.access_token) {
    try {
      const metaCampaign = campaignFor(campaigns, "meta");
      const spend = await refreshMetaSpend(meta, metaCampaign?.external_campaign_id ?? null);
      await updateAdAccount(meta.id, {
        spend_by_click: spend.clicks as Json,
        spend_refreshed_at: new Date().toISOString(),
      });
      if (metaCampaign) {
        await saveCampaign({
          tenantId,
          provider: "meta",
          externalCampaignId: metaCampaign.external_campaign_id,
          status: metaCampaign.status === "live" ? "live" : "paused",
          monthlyBudgetGbp: metaCampaign.monthly_budget_gbp ?? MONTHLY_BUDGET_MIN_GBP,
          details: {
            ...asRecord(metaCampaign.details),
            spendMinor: spend.spendMinor,
            spendCurrency: "GBP",
          },
          lastError: metaCampaign.last_error,
        });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Meta spend did not load.");
    }
  }
  return errors;
}
