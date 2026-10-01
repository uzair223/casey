import { describe, expect, it } from "vitest";

import { campaignDestination, searchAdCopy } from "@/lib/leads/acquisition/copy";
import {
  buildFirmAds,
  googleSearchMutations,
  metaGeo,
  readAdAssets,
  readAdPlaces,
  readAdTargeting,
} from "@/lib/leads/acquisition/creative";
import { renderBrandAdPng } from "@/lib/leads/acquisition/media";
import {
  adPhotoPrompt,
  chooseAdImageSource,
  readGeneratedImage,
  withoutMoneyPromise,
} from "@/lib/leads/acquisition/photo";
import { readWebsiteBrief, websiteUrlError } from "@/lib/leads/acquisition/site";
import {
  buildLeadHandoff,
  runLeadPushes,
  webhookUrlError,
} from "@/lib/leads/acquisition/push-result";
import {
  readAttribution,
  sourceLabel,
  withLeadAttribution,
} from "@/lib/leads/attribution";

describe("lead attribution", () => {
  it("names Google Ads, Meta, and the firm website without showing the click id", () => {
    expect(sourceLabel(readAttribution({ gclid: "abc123", page: "https://firm.example/contact" }))).toBe(
      "Google Ads",
    );
    expect(sourceLabel(readAttribution({ fbclid: "IwAR0test", utm_source: "facebook" }))).toBe("Meta");
    expect(sourceLabel(readAttribution({ page: "https://firm.example/contact" }))).toBe("Firm website");
    expect(sourceLabel(readAttribution({ utm_source: "google", utm_medium: "cpc" }))).toBe("Google Ads");
    expect(sourceLabel(null)).toBe("Enquiry");
  });

  it("keeps only the page, the referrer, the campaign fields, and the click ids", () => {
    const attribution = readAttribution({
      page: "https://firm.example/path?token=secret",
      referrer: "https://news.example/story",
      utm_campaign: "winter",
      gclid: "click-1",
      fbclid: "bad id",
      access_token: "should-not-stick",
    });
    expect(attribution.page).toBe("https://firm.example/path");
    expect(attribution.referrer).toBe("https://news.example/story");
    expect(attribution.utmCampaign).toBe("winter");
    expect(attribution.gclid).toBe("click-1");
    expect(attribution.fbclid).toBeNull();
    expect(attribution).not.toHaveProperty("access_token");
  });

  it("copies the click onto the lead answers", () => {
    const stored = withLeadAttribution(
      { summary: "A fall at work" },
      readAttribution({ gclid: "click-1", utm_source: "google" }),
    );
    expect(stored.summary).toBe("A fall at work");
    expect(sourceLabel(readAttribution(stored.attribution))).toBe("Google Ads");
  });
});

describe("campaign copy", () => {
  it("keeps the search headlines inside Google's length limit", () => {
    const copy = searchAdCopy("A Very Long Firm Name That Will Not Fit In A Headline");
    expect(copy.headlines).toHaveLength(3);
    expect(copy.headlines.every((line) => line.length <= 30 && line.length > 0)).toBe(true);
    expect(new Set(copy.headlines).size).toBe(3);
    expect(copy.descriptions.every((line) => line.length <= 90)).toBe(true);
  });

  it("points both campaigns at the enquiry chat", () => {
    expect(campaignDestination("https://north.go.caseyhq.co.uk", "google")).toContain(
      "utm_campaign=casey-search",
    );
    expect(campaignDestination("https://north.go.caseyhq.co.uk", "meta")).toContain(
      "utm_source=meta",
    );
    expect(campaignDestination("https://north.go.caseyhq.co.uk", "google", "Road accident")).toContain(
      "utm_content=road-accident",
    );
  });

  it("writes a separate ad for each claim and the places the firm named", () => {
    const ads = buildFirmAds({
      firmName: "North & Co",
      claims: ["Road Traffic Accident", "Employer Liability"],
      places: ["Manchester"],
    });
    expect(ads).toHaveLength(2);
    expect(ads.map((ad) => ad.claim)).toEqual(["Road accident", "Accident at work"]);
    for (const ad of ads) {
      expect(ad.headlines.length).toBeGreaterThanOrEqual(3);
      expect(new Set(ad.headlines.map((line) => line.toLowerCase())).size).toBe(ad.headlines.length);
      expect(ad.headlines.every((line) => line.length <= 30 && line.length > 0)).toBe(true);
      expect(ad.descriptions.every((line) => line.length <= 90)).toBe(true);
      expect(ad.keywords.some((keyword) => /manchester/i.test(keyword))).toBe(true);
    }
  });

  it("covers the UK when the firm has not named a place", () => {
    const [ad] = buildFirmAds({
      firmName: "North",
      claims: ["Housing Disrepair"],
      places: [],
    });
    expect(ad.descriptions.some((line) => line.includes("UK"))).toBe(true);
  });

  it("keeps only short place names", () => {
    expect(readAdPlaces("Manchester, Leeds\n<script>, Manchester")).toEqual(["Manchester", "Leeds"]);
    expect(readAdPlaces(["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"])).toHaveLength(
      8,
    );
  });

  it("builds one Google ad group per claim and a location criterion", () => {
    const ads = buildFirmAds({
      firmName: "North",
      claims: ["Road Traffic Accident", "Employer Liability"],
      places: ["Manchester"],
    });
    const operations = googleSearchMutations({
      customerId: "123",
      dailyMicros: "1000000",
      baseUrl: "https://north.go.caseyhq.co.uk",
      ads,
      geoIds: ["1001"],
      stamp: 1,
    });
    expect(operations.filter((operation) => "adGroupOperation" in (operation as object))).toHaveLength(2);
    expect(JSON.stringify(operations)).toContain("geoTargetConstants/1001");
  });

  it("targets named cities on Meta and the UK when none match", () => {
    expect(metaGeo([])).toEqual({
      geo_locations: { countries: ["GB"], location_types: ["home", "recent"] },
    });
    expect(metaGeo([{ key: "city-1", city: true }])).toEqual({
      geo_locations: {
        cities: [{ key: "city-1", radius: 15, distance_unit: "mile" }],
        location_types: ["home", "recent"],
      },
    });
  });
});

describe("brand ad image", () => {
  it("draws a PNG in the firm colours", () => {
    const png = renderBrandAdPng({
      firmName: "North",
      line: "Hurt at work?",
      background: "#112233",
      text: "#f3efe6",
      size: 64,
    });
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

describe("firm website and images", () => {
  it("reads places and claim language from the public page", () => {
    const brief = readWebsiteBrief(`
      <html><head>
        <title>North Law</title>
        <meta name="description" content="Help after a road accident in Manchester.">
      </head>
      <body><h1>Our Leeds office</h1><p>People hurt at work can tell us what happened.</p></body>
      </html>
    `);
    expect(brief.summary).toContain("Manchester");
    expect(brief.places).toEqual(expect.arrayContaining(["Manchester", "Leeds"]));
    expect(brief.claims).toEqual(expect.arrayContaining(["Road accident", "Accident at work"]));
  });

  it("keeps the website on a public https address", () => {
    expect(websiteUrlError("http://firm.example")).toMatch(/https/);
    expect(websiteUrlError("https://127.0.0.1")).toMatch(/public/);
    expect(websiteUrlError("https://north.example")).toBeNull();
  });

  it("keeps uploaded images and the website note when places are saved", () => {
    const targeting = readAdTargeting({
      places: ["Leeds"],
      websiteUrl: "https://north.example",
      siteSummary: "Help after a road accident.",
      sitePlaces: ["Manchester"],
      siteClaims: ["Road accident"],
      assets: [
        { id: "11111111-1111-1111-1111-111111111111", name: "office.jpg", contentType: "image/jpeg" },
        { id: "../secret", name: "nope.png", contentType: "image/png" },
      ],
    });
    expect(targeting.places).toEqual(["Leeds"]);
    expect(targeting.websiteUrl).toBe("https://north.example");
    expect(targeting.assets).toHaveLength(1);
    expect(readAdAssets(Array.from({ length: 8 }, (_, index) => ({
      id: `11111111-1111-1111-1111-11111111111${index}`,
      name: "image",
      contentType: "image/png",
    })))).toHaveLength(6);
  });
});

const EQUITAS_HOME = `
  <html><head>
    <title>Equitas Solicitors</title>
    <meta name="description" content="Successfully securing compensation for clients in Preston.">
  </head><body>
    <h1>One of the UK’s Most Trusted Personal Injury Claims Specialists</h1>
    <p>The office is in Fulwood, Preston.</p>
    <h2>Medical Negligence Claims</h2>
    <h2>Accident at Work Claims</h2>
    <p>Protecting cyclists injured by dangerous roads.</p>
    <h2>PCP / Car Finance Claims</h2>
    <h2>Slip and Trip Claims</h2>
    <h2>Road Traffic Accident Claims</h2>
    <h2>Housing Disrepair Claims</h2>
  </body></html>
`;

describe("Equitas Solicitors ads", () => {
  it("reads Preston and the claim types, and does not promise compensation", () => {
    const brief = readWebsiteBrief(EQUITAS_HOME);
    expect(brief.places).toEqual(["Preston"]);
    expect(brief.places).not.toContain("Fulwood");
    expect(brief.claims).toEqual([
      "Road accident",
      "Accident at work",
      "Public place accident",
      "Medical treatment",
      "Housing disrepair",
    ]);
    const voice = withoutMoneyPromise(brief.summary ?? "");
    expect(voice).not.toMatch(/compensation|settlement|payout/i);
    const ads = buildFirmAds({
      firmName: "Equitas Solicitors",
      claims: brief.claims,
      places: brief.places,
      voice: brief.summary,
    });
    for (const ad of ads) {
      expect(ad.descriptions.join(" ")).not.toMatch(/compensation|settlement|payout/i);
    }
    const prompt = adPhotoPrompt({
      firmName: "Equitas Solicitors",
      claim: "Road accident",
      places: brief.places,
      summary: brief.summary,
      background: "#1f3a2e",
    });
    expect(prompt).toContain("Preston");
    expect(prompt).toContain("No readable text");
    expect(prompt).not.toMatch(/compensation|settlement|payout/i);
    expect(chooseAdImageSource(false, true)).toBe("photo");
    expect(chooseAdImageSource(true, true)).toBe("upload");
    expect(chooseAdImageSource(false, false)).toBe("card");
  });

  it("reads a generated photograph from a JSON image response", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const body = Buffer.from(JSON.stringify({ result: { image: png.toString("base64") } }));
    const image = readGeneratedImage(body, "application/json");
    expect(image?.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });
});

describe("accepted lead handoff", () => {
  it("sends the contact, the summary, and the source", () => {
    expect(
      buildLeadHandoff({
        statementId: "lead-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: null,
        summary: "A fall at work",
        source: "Google Ads",
      }),
    ).toEqual({
      event: "lead.accepted",
      statementId: "lead-1",
      contact: { name: "Ada Lovelace", email: "ada@example.com", phone: null },
      summary: "A fall at work",
      source: "Google Ads",
    });
  });

  it("records a failed send without stopping the other system", async () => {
    const results = await runLeadPushes([
      { provider: "clio", send: async () => { throw new Error("Clio refused the matter."); } },
      { provider: "webhook", send: async () => undefined },
    ]);
    expect(results).toEqual([
      { provider: "clio", status: "failed", error: "Clio refused the matter." },
      { provider: "webhook", status: "sent", error: null },
    ]);
  });

  it("rejects a webhook that is not a public https address", () => {
    expect(webhookUrlError("http://example.com/hook")).toMatch(/https/);
    expect(webhookUrlError("https://127.0.0.1/hook")).toMatch(/public/);
    expect(webhookUrlError("https://hooks.example.com/casey")).toBeNull();
  });
});
