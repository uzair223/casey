import "server-only";

import { widgetEnabled } from "@/lib/billing/plans";
import { firmPageUrl } from "@/lib/firm-page-host";
import { readAdTargeting } from "./creative";
import { billingPeriodStart, nextPhotoUsage, MONTHLY_PHOTO_ALLOWANCE } from "./studio";
import {
  attributionFromAnswers,
  formatMinor,
  hasAttribution,
  readAttribution,
  sourceLabel,
} from "@/lib/leads/attribution";
import { getServiceClient } from "@/lib/supabase/server";
import { clioConfigured } from "./clio";
import { googleConfigured } from "./google";
import { metaConfigured } from "./meta";
import { asRecord, listAdAccounts, listCampaigns, listCrmConnections } from "./store";
import type { AcquisitionBoard, AcquisitionCampaign } from "./types";

type SpendEntry = { minor?: unknown; currency?: unknown };

function spendMap(value: unknown) {
  const record = asRecord(value);
  const map = new Map<string, { minor: number; currency: string }>();
  for (const [key, entry] of Object.entries(record)) {
    const spend = entry as SpendEntry;
    const minor = Number(spend?.minor);
    const currency = typeof spend?.currency === "string" ? spend.currency : "GBP";
    if (Number.isFinite(minor) && minor > 0) map.set(key, { minor, currency });
  }
  return map;
}

function matchedSpend(
  attribution: ReturnType<typeof readAttribution>,
  map: Map<string, { minor: number; currency: string }>,
) {
  if (attribution.gclid) {
    const hit = map.get(`gclid:${attribution.gclid}`);
    if (hit) return formatMinor(hit.minor, hit.currency);
  }
  if (attribution.fbclid) {
    const hit = map.get(`fbclid:${attribution.fbclid}`);
    if (hit) return formatMinor(hit.minor, hit.currency);
  }
  const source = (attribution.utmSource ?? "").toLowerCase();
  const metaLead =
    Boolean(attribution.fbclid) ||
    source === "meta" ||
    source === "facebook" ||
    source === "instagram";
  if (metaLead && attribution.utmCampaign) {
    const hit = map.get(`campaign:${attribution.utmCampaign}`);
    if (hit) return formatMinor(hit.minor, hit.currency);
  }
  return null;
}

export async function loadAcquisitionBoard(tenantId: string): Promise<AcquisitionBoard> {
  const supabase = getServiceClient("acquisition-board");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [
    { data: tenant, error: tenantError },
    accounts,
    campaigns,
    connections,
    { data: leads, error: leadError },
    { data: sessions, error: sessionError },
    { data: pushes, error: pushError },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("plan, public_slug, ad_targeting, billing_period_start")
      .eq("id", tenantId)
      .maybeSingle(),
    listAdAccounts(tenantId),
    listCampaigns(tenantId),
    listCrmConnections(tenantId),
    supabase
      .from("statements")
      .select("id, qualification_answers")
      .eq("tenant_id", tenantId)
      .eq("participant_kind", "primary"),
    supabase
      .from("lead_sessions")
      .select("id, created_at, status, attribution, promoted_statement_id")
      .eq("tenant_id", tenantId)
      .is("promoted_statement_id", null)
      .neq("status", "promoted")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("crm_pushes")
      .select("statement_id, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (tenantError || leadError || sessionError || pushError) {
    throw tenantError ?? leadError ?? sessionError ?? pushError;
  }

  const spend = new Map<string, { minor: number; currency: string }>();
  for (const account of accounts) {
    for (const [key, value] of spendMap(account.spend_by_click)) spend.set(key, value);
  }

  const sources: AcquisitionBoard["sources"] = {};
  for (const lead of leads ?? []) {
    const attribution = attributionFromAnswers(lead.qualification_answers);
    if (!hasAttribution(attribution)) continue;
    sources[lead.id] = {
      label: sourceLabel(attribution),
      spend: matchedSpend(attribution, spend),
    };
  }

  const handoffs: AcquisitionBoard["handoffs"] = {};
  for (const push of pushes ?? []) {
    if (handoffs[push.statement_id]) continue;
    if (push.status === "sent" || push.status === "failed") {
      handoffs[push.statement_id] = push.status;
    }
  }

  const clio = connections.find((connection) => connection.provider === "clio");
  const webhook = connections.find((connection) => connection.provider === "webhook");
  const targeting = readAdTargeting(tenant?.ad_targeting);
  const allowance = nextPhotoUsage(
    targeting.photoUsage,
    billingPeriodStart(tenant?.billing_period_start),
  );
  const listed: AcquisitionCampaign[] = campaigns.map((campaign) => {
    const details = asRecord(campaign.details);
    const spendMinor = Number(details.spendMinor);
    const provider = campaign.provider === "meta" ? "meta" : "google";
    return {
      provider,
      status: campaign.status === "live" ? "live" : "paused",
      monthlyBudgetGbp: campaign.monthly_budget_gbp,
      externalCampaignId: campaign.external_campaign_id,
      spend:
        Number.isFinite(spendMinor) && spendMinor > 0
          ? formatMinor(spendMinor, typeof details.spendCurrency === "string" ? details.spendCurrency : "GBP")
          : null,
      error: campaign.last_error,
    };
  });

  return {
    growth: widgetEnabled(tenant?.plan),
    trackingUrl: tenant?.public_slug ? firmPageUrl(tenant.public_slug) : null,
    places: targeting.places,
    assets: targeting.assets.map((asset) => ({ id: asset.id, name: asset.name })),
    website: targeting.websiteUrl
      ? {
          url: targeting.websiteUrl,
          summary: targeting.siteSummary,
          places: targeting.sitePlaces,
          claims: targeting.siteClaims,
        }
      : null,
    proposal: targeting.proposal
      ? {
          title: targeting.proposal.title,
          summary: targeting.proposal.summary,
          welcome: targeting.proposal.welcome,
          colours: targeting.proposal.colours,
          images: targeting.proposal.images.map((image) => ({ id: image.id, name: image.name })),
          places: targeting.proposal.places,
          claims: targeting.proposal.claims,
        }
      : null,
    photoAllowance: {
      used: allowance.used,
      limit: MONTHLY_PHOTO_ALLOWANCE,
      remaining: allowance.remaining,
    },
    googleConfigured: googleConfigured(),
    metaConfigured: metaConfigured(),
    clioConfigured: clioConfigured(),
    googleConnected: accounts.some((account) => account.provider === "google" && account.access_token),
    metaConnected: accounts.some((account) => account.provider === "meta" && account.access_token),
    clioConnected: Boolean(clio?.access_token),
    clioRegion: clio?.region ?? null,
    webhookUrl: webhook?.webhook_url ?? null,
    campaigns: listed,
    sources,
    started: (sessions ?? []).map((session) => ({
      id: session.id,
      createdAt: session.created_at,
      label: sourceLabel(readAttribution(session.attribution)),
      status: "started" as const,
    })),
    handoffs,
  };
}
