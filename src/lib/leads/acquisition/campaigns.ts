import "server-only";

import { firmPageUrl } from "@/lib/firm-page-host";
import { attributionFromAnswers, readAttribution } from "@/lib/leads/attribution";
import { detectImageType, readLeadBranding } from "@/lib/leads/logo";
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
  adCopyRefusal,
  adPhotoPrompt,
  chooseAdImageSource,
} from "./photo";
import {
  adFingerprint,
  applyApprovedCopy,
  buildFirmAds,
  claimContentSlug,
  claimFingerprint,
  readAdPlaces,
  readAdTargeting,
  type ApprovedAd,
  type FirmAd,
} from "./creative";
import {
  createGoogleSearchCampaign,
  refreshGoogleSpend,
  resolveGooglePlaces,
  setGoogleAdGroupStatus,
  setGoogleBudget,
  setGoogleCampaignStatus,
} from "./google";
import { ProviderError } from "./http";
import { renderBrandAdPng } from "./media";
import { generateAdPhoto, loadGeneratedPhoto, storeGeneratedPhoto } from "./photo-generate";
import {
  billingPeriodStart,
  campaignRecommendation,
  groupClaimResults,
  imageWhenAllowanceSpent,
  nextPhotoUsage,
  takePhoto,
} from "./studio";
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
      .select("name, public_slug, intake_branding, ad_targeting, billing_period_start")
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
    approved: targeting.ads,
    periodStart: billingPeriodStart(tenant.billing_period_start),
  };
}

async function savePlaces(tenantId: string, places: string[]) {
  const current = await loadAdTargeting(tenantId);
  await saveAdTargeting(tenantId, { ...current, places });
}

function brandCard(firm: Awaited<ReturnType<typeof loadFirm>>, ad: FirmAd) {
  return renderBrandAdPng({
    firmName: firm.firmName,
    line: ad.imageLine,
    background: firm.background,
    text: firm.text,
  });
}

function imageDataUrl(bytes: Buffer) {
  const type = detectImageType(bytes) === "image/jpeg" ? "image/jpeg" : "image/png";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

async function assetBytes(
  tenantId: string,
  assets: Awaited<ReturnType<typeof loadFirm>>["assets"],
  id: string,
) {
  const asset = assets.find((item) => item.id === id);
  if (!asset) return null;
  const [bytes] = await loadAdAssetBytes(tenantId, [asset]);
  return bytes ?? null;
}

function referenceIds(firm: Awaited<ReturnType<typeof loadFirm>>, edit: ApprovedAd | undefined) {
  const chosen = edit?.referenceAssetIds.length ? edit.referenceAssetIds : firm.assets.map((asset) => asset.id);
  return chosen.slice(0, 4);
}

async function resolveAdImages(
  tenantId: string,
  firm: Awaited<ReturnType<typeof loadFirm>>,
  ads: FirmAd[],
  fingerprint: string,
  places: string[],
) {
  const targeting = await loadAdTargeting(tenantId);
  let photoUsage = targeting.photoUsage;
  const items = [...(targeting.generated?.items ?? [])];
  const images: Buffer[] = [];
  let changed = false;
  for (const ad of ads.slice(0, 6)) {
    const edit = firm.approved.find((item) => item.claim === ad.claim);
    const references = referenceIds(firm, edit);
    const key = claimFingerprint({
      firmName: firm.firmName,
      claim: ad.claim,
      places,
      background: firm.background,
      text: firm.text,
      destination: firm.baseUrl,
      voice: firm.voice,
      prompt: edit?.prompt ?? "",
      headlines: ad.headlines,
      descriptions: ad.descriptions,
      referenceAssetIds: references,
    });
    if (edit?.imageMode === "library" && edit.libraryAssetId && chooseAdImageSource("library", true) === "upload") {
      const library = await assetBytes(tenantId, firm.assets, edit.libraryAssetId);
      images.push(library ?? brandCard(firm, ad));
      continue;
    }
    const hit = items.find((item) => item.claim === ad.claim && (item.fingerprint || fingerprint) === key);
    const saved = hit ? await loadGeneratedPhoto(tenantId, hit.id) : null;
    if (hit && saved && chooseAdImageSource("generate", true) === "photo") {
      images.push(saved);
      continue;
    }
    const allowance = takePhoto(photoUsage, firm.periodStart);
    if (!allowance.allowed) {
      const cached = Boolean(hit && saved);
      images.push(imageWhenAllowanceSpent(cached) === "photo" && saved ? saved : brandCard(firm, ad));
      continue;
    }
    const files: Buffer[] = [];
    for (const id of references) {
      const bytes = await assetBytes(tenantId, firm.assets, id);
      if (bytes) files.push(bytes);
    }
    const photo = await generateAdPhoto(
      adPhotoPrompt({
        firmName: firm.firmName,
        claim: ad.claim,
        places,
        summary: firm.voice,
        background: firm.background,
        references: files.length,
        direction: edit?.prompt,
      }),
      files,
    );
    if (!photo || chooseAdImageSource("generate", true) !== "photo") {
      images.push(brandCard(firm, ad));
      continue;
    }
    const id = crypto.randomUUID();
    if (await storeGeneratedPhoto(tenantId, id, photo)) {
      photoUsage = allowance.usage;
      const next = { claim: ad.claim, id, fingerprint: key };
      const index = items.findIndex((item) => item.claim === ad.claim);
      if (index >= 0) items[index] = next;
      else items.push(next);
      changed = true;
    }
    images.push(photo);
  }
  for (const ad of ads.slice(6)) images.push(brandCard(firm, ad));
  if (changed) {
    await saveAdTargeting(tenantId, {
      ...targeting,
      photoUsage,
      generated: items.length ? { fingerprint, items } : targeting.generated,
    });
  }
  return images;
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
  const ads = applyApprovedCopy(
    buildFirmAds({
      firmName: firm.firmName,
      claims: firm.claims,
      places,
      voice: firm.voice,
    }),
    firm.approved,
  );
  const fingerprint = adFingerprint({
    firmName: firm.firmName,
    claims: firm.claims,
    places,
    background: firm.background,
    text: firm.text,
    destination: firm.baseUrl,
    voice: firm.voice,
    assetIds: firm.assets.map((asset) => asset.id),
    copy: ads.map((ad) => `${ad.headlines.join("|")} ${ad.descriptions.join("|")}`).join(";"),
  });
  const images = await resolveAdImages(tenantId, firm, ads, fingerprint, places);
  return {
    places,
    ads: ads.map((ad, index) => ({
      claim: ad.claim,
      headlines: ad.headlines,
      descriptions: ad.descriptions,
      image: imageDataUrl(images[index] ?? brandCard(firm, ad)),
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
  const ads = applyApprovedCopy(
    buildFirmAds({
      firmName: firm.firmName,
      claims: firm.claims,
      places: firm.places,
      voice: firm.voice,
    }),
    firm.approved,
  );
  const refusal = ads
    .map((ad) => adCopyRefusal([...ad.headlines, ...ad.descriptions].join(" ")))
    .find((message): message is string => Boolean(message));
  if (refusal && params.action !== "pause") throw new ProviderError(refusal);
  const fingerprint = adFingerprint({
    firmName: firm.firmName,
    claims: firm.claims,
    places: firm.places,
    background: firm.background,
    text: firm.text,
    destination: firm.baseUrl,
    voice: firm.voice,
    assetIds: firm.assets.map((asset) => asset.id),
    copy: ads.map((ad) => `${ad.headlines.join("|")} ${ad.descriptions.join("|")}`).join(";"),
  });
  const images = await resolveAdImages(
    params.tenantId,
    firm,
    ads,
    fingerprint,
    firm.places,
  );
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
      claimAds: created.adGroups,
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
      claimAds: params.ads.map((ad, index) => ({ claim: ad.claim, adId: created.adIds[index] ?? null })),
      fingerprint: params.fingerprint,
      missedPlaces: places.missed,
    };
    if (params.enabled) {
      try {
        const liveAds = created.adIds.filter((_, index) => !params.ads[index]?.paused);
        await setMetaCampaignStatus(
          params.account,
          [created.campaignId, created.adSetId, ...liveAds],
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

function draftedAds(firm: Awaited<ReturnType<typeof loadFirm>>, places = firm.places) {
  return applyApprovedCopy(
    buildFirmAds({
      firmName: firm.firmName,
      claims: firm.claims,
      places,
      voice: firm.voice,
    }),
    firm.approved,
  );
}

export async function loadCreativeDraft(tenantId: string) {
  const firm = await loadFirm(tenantId);
  const targeting = await loadAdTargeting(tenantId);
  const allowance = nextPhotoUsage(targeting.photoUsage, firm.periodStart);
  const ads = draftedAds(firm);
  const results = await loadClaimResults(tenantId, ads.map((ad) => ad.claim));
  return {
    places: firm.places,
    assets: firm.assets.map((asset) => ({ id: asset.id, name: asset.name })),
    allowance: {
      used: allowance.used,
      limit: allowance.used + allowance.remaining,
      remaining: allowance.remaining,
    },
    recommendation: campaignRecommendation(results),
    results,
    ads: ads.map((ad) => {
      const edit = firm.approved.find((item) => item.claim === ad.claim);
      return {
        claim: ad.claim,
        headlines: ad.headlines,
        descriptions: ad.descriptions,
        prompt: edit?.prompt ?? "",
        imageMode: edit?.imageMode ?? "generate",
        referenceAssetIds: edit?.referenceAssetIds ?? [],
        libraryAssetId: edit?.libraryAssetId ?? null,
        paused: Boolean(ad.paused),
      };
    }),
  };
}

export async function saveCreativeDraft(tenantId: string, incoming: ApprovedAd[]) {
  const firm = await loadFirm(tenantId);
  const current = draftedAds(firm);
  const next = incoming.filter((ad) => current.some((item) => item.claim === ad.claim));
  const refusal = next
    .map((ad) => adCopyRefusal([...ad.headlines, ...ad.descriptions, ad.prompt].join(" ")))
    .find((message): message is string => Boolean(message));
  if (refusal) throw new ProviderError(refusal);
  const targeting = await loadAdTargeting(tenantId);
  const parsed = readAdTargeting({ ...targeting, ads: next }).ads;
  await saveAdTargeting(tenantId, { ...targeting, ads: parsed });
}

export async function setCreativeClaimPaused(tenantId: string, claim: string, paused: boolean) {
  const targeting = await loadAdTargeting(tenantId);
  const firm = await loadFirm(tenantId);
  const existing = targeting.ads.find((ad) => ad.claim === claim);
  const drafted = draftedAds(firm).find((ad) => ad.claim === claim);
  if (!drafted) throw new ProviderError("That lead type is not on.");
  const ads = targeting.ads.filter((ad) => ad.claim !== claim);
  ads.push({
    claim,
    headlines: existing?.headlines ?? drafted.headlines,
    descriptions: existing?.descriptions ?? drafted.descriptions,
    prompt: existing?.prompt ?? "",
    referenceAssetIds: existing?.referenceAssetIds ?? [],
    imageMode: existing?.imageMode ?? "generate",
    libraryAssetId: existing?.libraryAssetId ?? null,
    paused,
  });
  await saveAdTargeting(tenantId, { ...targeting, ads });
  const accounts = await listAdAccounts(tenantId);
  const campaigns = await listCampaigns(tenantId);
  const google = accountFor(accounts, "google");
  const meta = accountFor(accounts, "meta");
  const googleAds = Array.isArray(asRecord(campaignFor(campaigns, "google")?.details).claimAds)
    ? (asRecord(campaignFor(campaigns, "google")?.details).claimAds as Array<{ claim?: string; adGroupId?: string }>)
    : [];
  const metaAds = Array.isArray(asRecord(campaignFor(campaigns, "meta")?.details).claimAds)
    ? (asRecord(campaignFor(campaigns, "meta")?.details).claimAds as Array<{ claim?: string; adId?: string }>)
    : [];
  const adGroupId = googleAds.find((ad) => ad.claim === claim)?.adGroupId;
  const adId = metaAds.find((ad) => ad.claim === claim)?.adId;
  if (google && adGroupId) await setGoogleAdGroupStatus(google, adGroupId, paused ? "PAUSED" : "ENABLED");
  if (meta && adId) await setMetaCampaignStatus(meta, [adId], paused ? "PAUSED" : "ACTIVE");
}

function spendMinorFor(
  attribution: ReturnType<typeof readAttribution>,
  map: Map<string, number>,
) {
  if (attribution.gclid) return map.get(`gclid:${attribution.gclid}`) ?? 0;
  if (attribution.fbclid) return map.get(`fbclid:${attribution.fbclid}`) ?? 0;
  const source = (attribution.utmSource ?? "").toLowerCase();
  const metaLead = Boolean(attribution.fbclid) || source === "meta" || source === "facebook" || source === "instagram";
  if (metaLead && attribution.utmCampaign) return map.get(`campaign:${attribution.utmCampaign}`) ?? 0;
  return 0;
}

async function loadClaimResults(tenantId: string, claims: string[]) {
  const supabase = getServiceClient("creative-results");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [accounts, { data: sessions, error: sessionError }, { data: leads, error: leadError }] = await Promise.all([
    listAdAccounts(tenantId),
    supabase
      .from("lead_sessions")
      .select("attribution, promoted_statement_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .limit(500),
    supabase
      .from("statements")
      .select("lead_stage, qualification_answers")
      .eq("tenant_id", tenantId)
      .eq("participant_kind", "primary")
      .limit(500),
  ]);
  if (sessionError || leadError) throw sessionError ?? leadError;
  const spend = new Map<string, number>();
  for (const account of accounts) {
    const record = asRecord(account.spend_by_click);
    for (const [key, entry] of Object.entries(record)) {
      const minor = Number((entry as { minor?: unknown }).minor);
      if (Number.isFinite(minor) && minor > 0) spend.set(key, (spend.get(key) ?? 0) + minor);
    }
  }
  const events = [
    ...(sessions ?? []).map((session) => {
      const attribution = readAttribution(session.attribution);
      return {
        slug: attribution.utmContent,
        stage: "started" as const,
        spendMinor: session.promoted_statement_id ? 0 : spendMinorFor(attribution, spend),
      };
    }),
    ...(leads ?? []).flatMap((lead) => {
      if (lead.lead_stage === "new") return [];
      const attribution = attributionFromAnswers(lead.qualification_answers);
      return [{
        slug: attribution.utmContent,
        stage: lead.lead_stage === "declined" ? ("declined" as const) : ("accepted" as const),
        spendMinor: spendMinorFor(attribution, spend),
      }];
    }),
  ];
  return groupClaimResults(claims, events).map((row) => ({
    ...row,
    slug: claimContentSlug(row.claim),
  }));
}
