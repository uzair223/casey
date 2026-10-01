export type LeadAttribution = {
  page: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  fbclid: string | null;
  placement: string | null;
};

const EMPTY: LeadAttribution = {
  page: null,
  referrer: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  gclid: null,
  fbclid: null,
  placement: null,
};

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function clipLabel(value: unknown) {
  const text = clip(value, 80);
  if (!text || /[<>"'`]/.test(text)) return null;
  return text;
}

function clipId(value: unknown) {
  const text = clip(value, 200);
  if (!text || !/^[A-Za-z0-9._~-]{1,200}$/.test(text)) return null;
  return text;
}

function clipUrl(value: unknown) {
  const text = clip(value, 300);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

function field(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] != null) return record[key];
  }
  return null;
}

export function readAttribution(input: unknown): LeadAttribution {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const placement = clipLabel(field(record, "placement", "dataCampaign", "data-campaign"));
  return {
    page: clipUrl(field(record, "page")),
    referrer: clipUrl(field(record, "referrer")),
    utmSource: clipLabel(field(record, "utmSource", "utm_source")),
    utmMedium: clipLabel(field(record, "utmMedium", "utm_medium")),
    utmCampaign:
      clipLabel(field(record, "utmCampaign", "utm_campaign")) ?? placement,
    utmContent: clipLabel(field(record, "utmContent", "utm_content")),
    utmTerm: clipLabel(field(record, "utmTerm", "utm_term")),
    gclid: clipId(field(record, "gclid")),
    fbclid: clipId(field(record, "fbclid")),
    placement,
  };
}

export function attributionFromQuery(
  query: Record<string, string | string[] | undefined>,
): LeadAttribution {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") flat[key] = value;
    else if (typeof value?.[0] === "string") flat[key] = value[0];
  }
  return readAttribution(flat);
}

export function hasAttribution(attribution: LeadAttribution | null | undefined) {
  if (!attribution) return false;
  return Object.values(attribution).some((value) => Boolean(value));
}

export function withLeadAttribution<T extends Record<string, unknown>>(
  answers: T,
  attribution: LeadAttribution | null | undefined,
): T & { attribution?: LeadAttribution } {
  if (!hasAttribution(attribution) || !attribution) return answers;
  return { ...answers, attribution };
}

export function attributionFromAnswers(value: unknown): LeadAttribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY };
  return readAttribution((value as { attribution?: unknown }).attribution);
}

export function sourceLabel(attribution: LeadAttribution | null | undefined) {
  if (!hasAttribution(attribution) || !attribution) return "Enquiry";
  const source = (attribution.utmSource ?? "").toLowerCase();
  const medium = (attribution.utmMedium ?? "").toLowerCase();
  if (
    attribution.gclid ||
    source === "google" ||
    source === "googleads" ||
    source.includes("google")
  ) {
    return "Google Ads";
  }
  if (
    attribution.fbclid ||
    source === "meta" ||
    source === "facebook" ||
    source === "fb" ||
    source === "instagram" ||
    source === "ig"
  ) {
    return "Meta";
  }
  if (medium === "cpc" || medium === "ppc" || medium === "paid") return "Paid ad";
  if (attribution.page || attribution.referrer || attribution.placement) {
    return "Firm website";
  }
  return "Enquiry";
}

export function formatMinor(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency || "GBP"}`;
  }
}
