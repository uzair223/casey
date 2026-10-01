import type { LeadBranding } from "@/lib/leads/schema";
import { claimContentSlug, type SiteProposal } from "./creative";

export const MONTHLY_PHOTO_ALLOWANCE = 60;

export type PhotoUsage = {
  periodStart: string;
  used: number;
};

export function billingPeriodStart(value: string | null | undefined) {
  if (value) return value;
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function nextPhotoUsage(current: PhotoUsage | null, periodStart: string) {
  const same = current?.periodStart === periodStart;
  const used = same ? Math.max(0, Math.min(MONTHLY_PHOTO_ALLOWANCE, current.used)) : 0;
  return {
    periodStart,
    used,
    remaining: MONTHLY_PHOTO_ALLOWANCE - used,
  };
}

export function takePhoto(current: PhotoUsage | null, periodStart: string) {
  const usage = nextPhotoUsage(current, periodStart);
  if (usage.remaining <= 0) return { allowed: false as const, usage };
  return {
    allowed: true as const,
    usage: { periodStart, used: usage.used + 1 },
  };
}

export function imageWhenAllowanceSpent(cached: boolean) {
  return cached ? ("photo" as const) : ("card" as const);
}

export type EnquiryEvent = {
  slug: string | null;
  stage: "started" | "accepted" | "declined";
  spendMinor: number;
};

export type ClaimResult = {
  claim: string;
  spendMinor: number;
  started: number;
  accepted: number;
  declined: number;
  costPerAcceptedMinor: number | null;
};

export function groupClaimResults(claims: string[], events: EnquiryEvent[]): ClaimResult[] {
  return claims.map((claim) => {
    const slug = claimContentSlug(claim);
    const rows = events.filter((event) => event.slug && event.slug === slug);
    const spendMinor = rows.reduce((sum, event) => sum + (event.spendMinor > 0 ? event.spendMinor : 0), 0);
    const started = rows.filter((event) => event.stage === "started").length;
    const accepted = rows.filter((event) => event.stage === "accepted").length;
    const declined = rows.filter((event) => event.stage === "declined").length;
    return {
      claim,
      spendMinor,
      started,
      accepted,
      declined,
      costPerAcceptedMinor: accepted > 0 ? Math.round(spendMinor / accepted) : null,
    };
  });
}

export function campaignRecommendation(rows: ClaimResult[]) {
  const producing = rows
    .filter((row) => row.accepted > 0)
    .sort((left, right) => right.accepted - left.accepted)[0];
  const wasting = rows
    .filter((row) => row.accepted === 0 && row.spendMinor > 0)
    .sort((left, right) => right.spendMinor - left.spendMinor)[0];
  if (producing && wasting) {
    return `${producing.claim} is producing accepted enquiries. ${wasting.claim} is spending without accepted enquiries.`;
  }
  if (producing) return `${producing.claim} is producing accepted enquiries.`;
  if (wasting) return `${wasting.claim} is spending without accepted enquiries.`;
  return null;
}

export function readGoogleForecast(value: unknown) {
  const root = value && typeof value === "object" ? (value as { campaignForecastMetrics?: unknown }) : null;
  const metrics =
    root?.campaignForecastMetrics && typeof root.campaignForecastMetrics === "object"
      ? (root.campaignForecastMetrics as Record<string, unknown>)
      : null;
  if (!metrics) return null;
  const impressions = Number(metrics.impressions ?? 0);
  const clicks = Number(metrics.clicks ?? 0);
  const micros = Number(metrics.costMicros ?? metrics.cost_micros ?? 0);
  if (!Number.isFinite(impressions) || !Number.isFinite(clicks) || !Number.isFinite(micros)) return null;
  return {
    impressions: Math.max(0, Math.round(impressions)),
    clicks: Math.max(0, Math.round(clicks)),
    costMinor: Math.max(0, Math.round(micros / 10_000)),
  };
}

export function readMetaDeliveryEstimate(value: unknown, dailyPence: number) {
  const data = value && typeof value === "object" ? (value as { data?: unknown }).data : null;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") return null;
  const curve = (row as { daily_outcomes_curve?: unknown }).daily_outcomes_curve;
  const points = Array.isArray(curve) ? curve : [];
  const target = Math.max(0, dailyPence) / 100;
  let best: { reach: number; impressions: number; distance: number } | null = null;
  for (const point of points) {
    if (!point || typeof point !== "object") continue;
    const record = point as { spend?: unknown; reach?: unknown; impressions?: unknown };
    const spend = Number(record.spend ?? 0);
    const reach = Number(record.reach ?? 0);
    const impressions = Number(record.impressions ?? 0);
    if (!Number.isFinite(spend) || !Number.isFinite(reach) || !Number.isFinite(impressions)) continue;
    const distance = Math.abs(spend - target);
    if (!best || distance < best.distance) {
      best = {
        reach: Math.max(0, Math.round(reach)),
        impressions: Math.max(0, Math.round(impressions)),
        distance,
      };
    }
  }
  if (best) return { reach: best.reach, impressions: best.impressions };
  const reach = Number((row as { estimate_dau?: unknown }).estimate_dau ?? 0);
  if (!Number.isFinite(reach)) return null;
  return { reach: Math.max(0, Math.round(reach)), impressions: 0 };
}

export function readSearchTerms(value: unknown) {
  const results =
    value && typeof value === "object" ? (value as { results?: unknown }).results : null;
  if (!Array.isArray(results)) return [];
  const terms: Array<{ term: string; clicks: number; costMinor: number }> = [];
  for (const row of results) {
    if (!row || typeof row !== "object") continue;
    const record = row as {
      searchTermView?: { searchTerm?: unknown };
      search_term_view?: { search_term?: unknown };
      metrics?: { clicks?: unknown; costMicros?: unknown; cost_micros?: unknown };
    };
    const term = String(
      record.searchTermView?.searchTerm ?? record.search_term_view?.search_term ?? "",
    ).trim();
    const clicks = Number(record.metrics?.clicks ?? 0);
    const micros = Number(record.metrics?.costMicros ?? record.metrics?.cost_micros ?? 0);
    if (!term || !Number.isFinite(clicks) || !Number.isFinite(micros) || micros <= 0) continue;
    terms.push({
      term: term.slice(0, 80),
      clicks: Math.max(0, Math.round(clicks)),
      costMinor: Math.max(0, Math.round(micros / 10_000)),
    });
    if (terms.length === 25) break;
  }
  return terms;
}

export function approvedBrandFields(
  proposal: Pick<SiteProposal, "title" | "welcome" | "colours">,
  selection: { language?: boolean; colours?: boolean },
): Partial<LeadBranding> {
  const patch: Partial<LeadBranding> = {};
  if (selection.language) {
    if (proposal.title) patch.displayName = proposal.title;
    if (proposal.welcome) patch.welcome = proposal.welcome;
  }
  if (selection.colours && proposal.colours[0]) {
    patch.primaryColor = proposal.colours[0];
    if (proposal.colours[1]) patch.backgroundColor = proposal.colours[1];
  }
  return patch;
}
