import { withoutMoneyPromise } from "./photo";

export type FirmAd = {
  claim: string;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  imageLine: string;
};

export function campaignDestination(
  base: string,
  provider: "google" | "meta",
  claim?: string,
) {
  const url = new URL(base);
  if (provider === "google") {
    url.searchParams.set("utm_source", "google");
    url.searchParams.set("utm_medium", "cpc");
    url.searchParams.set("utm_campaign", "casey-search");
  } else {
    url.searchParams.set("utm_source", "meta");
    url.searchParams.set("utm_medium", "paid");
    url.searchParams.set("utm_campaign", "casey-meta");
  }
  if (claim) {
    const content = claim
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    if (content) url.searchParams.set("utm_content", content);
  }
  return url.toString();
}

export function searchAdCopy(firmName: string) {
  const [ad] = buildFirmAds({ firmName, claims: ["Your enquiry"], places: [] });
  return { headlines: ad.headlines.slice(0, 3), descriptions: ad.descriptions };
}

const CLAIMS: Array<{
  match: RegExp;
  claim: string;
  question: string;
  keywords: string[];
}> = [
  {
    match: /road|traffic|(^|[^a-z])rta([^a-z]|$)/i,
    claim: "Road accident",
    question: "Hurt in a road accident?",
    keywords: ["road accident help", "car accident claim", "road traffic accident"],
  },
  {
    match: /employ|work/i,
    claim: "Accident at work",
    question: "Hurt at work?",
    keywords: ["accident at work", "work injury claim", "workplace accident help"],
  },
  {
    match: /public|premises|slip|trip/i,
    claim: "Public place accident",
    question: "Hurt in a public place?",
    keywords: ["accident in a public place", "slip or trip claim", "public place injury"],
  },
  {
    match: /clinical|negligen|medical/i,
    claim: "Medical treatment",
    question: "A problem with treatment?",
    keywords: ["medical treatment problem", "clinical negligence help", "treatment went wrong"],
  },
  {
    match: /hous|disrepair|damp|mould|mold/i,
    claim: "Housing disrepair",
    question: "Problems with your home?",
    keywords: ["housing disrepair", "damp and mould help", "home repairs not done"],
  },
];

function fit(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max).replace(/[\s,.:;-]+$/g, "").trim();
  return cut || text.slice(0, max).trim();
}

function keywordSafe(value: string) {
  return value.replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function unique(lines: string[], max: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const text = line.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length === max) break;
  }
  return result;
}

function claimFor(name: string) {
  const found = CLAIMS.find((item) => item.match.test(name));
  if (found) return found;
  const claim = fit(name.trim() || "Your enquiry", 40);
  const question = claim.length <= 28 ? `${claim}?` : "Tell us what happened";
  return {
    claim,
    question: fit(question, 30),
    keywords: [keywordSafe(claim.toLowerCase()) || "tell us what happened"],
  };
}

export function readAdPlaces(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];
  const places: string[] = [];
  for (const item of source) {
    if (typeof item !== "string") continue;
    const place = item.replace(/\s+/g, " ").trim();
    if (!place || place.length > 40) continue;
    if (!/^[\p{L}0-9 .'-]+$/u.test(place)) continue;
    if (places.some((existing) => existing.toLowerCase() === place.toLowerCase())) continue;
    places.push(place);
    if (places.length === 8) break;
  }
  return places;
}

export function placesFromTargeting(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return readAdPlaces((value as { places?: unknown }).places);
}

export type AdAssetRecord = {
  id: string;
  name: string;
  contentType: "image/png" | "image/jpeg";
};

const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readAdAssets(value: unknown): AdAssetRecord[] {
  if (!Array.isArray(value)) return [];
  const assets: AdAssetRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; name?: unknown; contentType?: unknown };
    if (typeof record.id !== "string" || !ASSET_ID.test(record.id)) continue;
    if (record.contentType !== "image/png" && record.contentType !== "image/jpeg") continue;
    const name =
      typeof record.name === "string"
        ? record.name.replace(/\s+/g, " ").trim().slice(0, 80)
        : "";
    assets.push({
      id: record.id,
      name: name || "image",
      contentType: record.contentType,
    });
    if (assets.length === 6) break;
  }
  return assets;
}

export type GeneratedPhoto = {
  claim: string;
  id: string;
};

export type GeneratedPhotoSet = {
  fingerprint: string;
  items: GeneratedPhoto[];
};

export type AdTargeting = {
  places: string[];
  assets: AdAssetRecord[];
  websiteUrl: string | null;
  siteSummary: string | null;
  sitePlaces: string[];
  siteClaims: string[];
  generated: GeneratedPhotoSet | null;
};

function readGeneratedPhotos(value: unknown): GeneratedPhotoSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { fingerprint?: unknown; items?: unknown };
  if (typeof record.fingerprint !== "string" || !record.fingerprint.trim()) return null;
  if (!Array.isArray(record.items)) return null;
  const items: GeneratedPhoto[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== "object") continue;
    const row = item as { claim?: unknown; id?: unknown };
    if (typeof row.claim !== "string" || !row.claim.trim()) continue;
    if (typeof row.id !== "string" || !ASSET_ID.test(row.id)) continue;
    items.push({ claim: row.claim.trim().slice(0, 80), id: row.id });
    if (items.length === 6) break;
  }
  if (!items.length) return null;
  return { fingerprint: record.fingerprint.slice(0, 4000), items };
}

export function readAdTargeting(value: unknown): AdTargeting {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const websiteUrl = typeof record.websiteUrl === "string" ? record.websiteUrl.trim() : "";
  const siteSummary = typeof record.siteSummary === "string" ? record.siteSummary.trim() : "";
  return {
    places: readAdPlaces(record.places),
    assets: readAdAssets(record.assets),
    websiteUrl: websiteUrl.startsWith("https://") ? websiteUrl.slice(0, 500) : null,
    siteSummary: siteSummary ? siteSummary.slice(0, 180) : null,
    sitePlaces: readAdPlaces(record.sitePlaces),
    siteClaims: Array.isArray(record.siteClaims)
      ? record.siteClaims
          .filter((claim): claim is string => typeof claim === "string")
          .map((claim) => claim.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [],
    generated: readGeneratedPhotos(record.generated),
  };
}

export function claimsMentioned(text: string) {
  return CLAIMS.filter((item) => item.match.test(text)).map((item) => item.claim);
}

export function buildFirmAds(params: {
  firmName: string;
  claims: string[];
  places: string[];
  voice?: string | null;
}) {
  const firm = fit(params.firmName.trim() || "The firm", 30);
  const names = params.claims.map((claim) => claim.trim()).filter(Boolean);
  const claims = names.length ? names : ["Your enquiry"];
  const placeLine =
    params.places.length === 1 && `Help in ${params.places[0]}`.length <= 30
      ? `Help in ${params.places[0]}`
      : "Help near you";
  const area =
    params.places.length === 0
      ? "The firm helps people across the UK."
      : params.places.length === 1
        ? `The firm helps people in ${params.places[0]}.`
        : `The firm helps people in ${params.places.slice(0, 2).join(" and ")}.`;

  return claims.map((name) => {
    const claim = claimFor(name);
    const headlines = unique(
      [firm === claim.question ? "Talk to the firm" : firm, claim.question, placeLine, "Tell us what happened"],
      4,
    );
    while (headlines.length < 3) {
      const spare = headlines.length === 1 ? "Talk to the firm" : "Speak to us today";
      if (!headlines.some((line) => line.toLowerCase() === spare.toLowerCase())) headlines.push(spare);
      else break;
    }
    const keywords = unique(
      [
        ...claim.keywords.map(keywordSafe),
        ...params.places.flatMap((place) =>
          claim.keywords.slice(0, 2).map((keyword) => keywordSafe(`${keyword} ${place}`)),
        ),
      ].filter((keyword) => keyword.length >= 3),
      8,
    );
    const voice = fit(withoutMoneyPromise(params.voice ?? ""), 90);
    return {
      claim: claim.claim,
      headlines: headlines.map((line) => fit(line, 30)),
      descriptions: unique(
        [
          fit(`${claim.question} Tell ${firm} what happened.`, 90),
          fit(area, 90),
          voice.length >= 12 ? voice : "A short enquiry is enough to get started.",
        ],
        3,
      ),
      keywords: keywords.length ? keywords : ["tell us what happened"],
      imageLine: claim.question,
    } satisfies FirmAd;
  });
}

export function adFingerprint(params: {
  firmName: string;
  claims: string[];
  places: string[];
  background: string;
  text: string;
  destination: string;
  voice?: string | null;
  assetIds?: string[];
}) {
  return JSON.stringify({
    firmName: params.firmName.trim(),
    claims: params.claims.map((claim) => claim.trim()).filter(Boolean).sort(),
    places: params.places.map((place) => place.toLowerCase()).sort(),
    background: params.background,
    text: params.text,
    destination: params.destination,
    voice: params.voice?.trim() ?? "",
    assetIds: (params.assetIds ?? []).slice().sort(),
  });
}

export function googleSearchMutations(params: {
  customerId: string;
  dailyMicros: string;
  baseUrl: string;
  ads: FirmAd[];
  geoIds: string[];
  stamp: number;
}) {
  const customer = params.customerId.replace(/\D/g, "");
  const geos = params.geoIds.length ? params.geoIds : ["2826"];
  const operations: unknown[] = [
    {
      campaignBudgetOperation: {
        create: {
          resourceName: `customers/${customer}/campaignBudgets/-1`,
          name: `Casey enquiry budget ${params.stamp}`,
          amountMicros: params.dailyMicros,
          deliveryMethod: "STANDARD",
          explicitlyShared: false,
        },
      },
    },
    {
      campaignOperation: {
        create: {
          resourceName: `customers/${customer}/campaigns/-2`,
          name: `Casey search ${params.stamp}`,
          advertisingChannelType: "SEARCH",
          status: "PAUSED",
          campaignBudget: `customers/${customer}/campaignBudgets/-1`,
          manualCpc: {},
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: false,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        },
      },
    },
    ...geos.map((geoId) => ({
      campaignCriterionOperation: {
        create: {
          campaign: `customers/${customer}/campaigns/-2`,
          location: { geoTargetConstant: `geoTargetConstants/${geoId.replace(/\D/g, "")}` },
        },
      },
    })),
  ];

  params.ads.forEach((ad, index) => {
    const adGroup = -(10 + index);
    operations.push({
      adGroupOperation: {
        create: {
          resourceName: `customers/${customer}/adGroups/${adGroup}`,
          name: ad.claim.slice(0, 80),
          campaign: `customers/${customer}/campaigns/-2`,
          status: "ENABLED",
          type: "SEARCH_STANDARD",
          cpcBidMicros: "1000000",
        },
      },
    });
    operations.push({
      adGroupAdOperation: {
        create: {
          adGroup: `customers/${customer}/adGroups/${adGroup}`,
          status: "ENABLED",
          ad: {
            finalUrls: [campaignDestination(params.baseUrl, "google", ad.claim)],
            responsiveSearchAd: {
              headlines: ad.headlines.map((text) => ({ text })),
              descriptions: ad.descriptions.map((text) => ({ text })),
            },
          },
        },
      },
    });
    for (const keyword of ad.keywords) {
      operations.push({
        adGroupCriterionOperation: {
          create: {
            adGroup: `customers/${customer}/adGroups/${adGroup}`,
            status: "ENABLED",
            keyword: { text: keyword, matchType: "PHRASE" },
          },
        },
      });
    }
  });
  return operations;
}

export function metaGeo(places: Array<{ key: string; city: boolean }>) {
  if (!places.length) {
    return { geo_locations: { countries: ["GB"], location_types: ["home", "recent"] } };
  }
  const cities = places.filter((place) => place.city);
  const regions = places.filter((place) => !place.city);
  return {
    geo_locations: {
      ...(cities.length
        ? {
            cities: cities.map((place) => ({
              key: place.key,
              radius: 15,
              distance_unit: "mile",
            })),
          }
        : {}),
      ...(regions.length ? { regions: regions.map((place) => ({ key: place.key })) } : {}),
      location_types: ["home", "recent"],
    },
  };
}
