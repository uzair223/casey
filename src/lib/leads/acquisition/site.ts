import { claimsMentioned, readAdPlaces } from "./creative";
import { publicHttpsUrlError } from "./push-result";

const PLACES = [
  "London",
  "Manchester",
  "Birmingham",
  "Leeds",
  "Liverpool",
  "Bristol",
  "Sheffield",
  "Newcastle",
  "Nottingham",
  "Leicester",
  "Coventry",
  "Cardiff",
  "Belfast",
  "Edinburgh",
  "Glasgow",
  "Southampton",
  "Portsmouth",
  "Plymouth",
  "Derby",
  "Wolverhampton",
  "Stoke-on-Trent",
  "Sunderland",
  "Norwich",
  "Swansea",
  "Bournemouth",
  "Middlesbrough",
  "Oxford",
  "Cambridge",
  "York",
  "Preston",
  "Brighton",
  "Aberdeen",
  "Dundee",
  "Exeter",
  "Gloucester",
  "Milton Keynes",
  "Northampton",
  "Luton",
  "Blackpool",
  "Bolton",
  "Chester",
  "Wakefield",
  "Doncaster",
  "Lincoln",
  "Worcester",
  "Canterbury",
  "Croydon",
  "Greater Manchester",
  "West Yorkshire",
  "South Yorkshire",
  "West Midlands",
];

export type WebsiteBrief = {
  title: string | null;
  summary: string | null;
  places: string[];
  claims: string[];
};

export function websiteUrlError(value: string) {
  return publicHttpsUrlError(value, "Enter the firm's website.");
}

function decodeText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`,
    "i",
  );
  const match = html.match(pattern);
  return decodeText(match?.[1] || match?.[2] || "");
}

export function readWebsiteBrief(html: string): WebsiteBrief {
  const source = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const title = decodeText(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(source, "description") || metaContent(source, "og:description");
  const headings = [...source.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((match) => decodeText(match[1] ?? ""))
    .filter(Boolean);
  const text = `${title} ${description} ${headings.join(" ")} ${decodeText(source)}`.slice(0, 8000);
  const places = readAdPlaces(
    PLACES.filter((place) => {
      const pattern = place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${pattern}\\b`, "i").test(text);
    }),
  );
  const summary = (description || headings[0] || "").slice(0, 180);
  return {
    title: title.slice(0, 120) || null,
    summary: summary || null,
    places,
    claims: claimsMentioned(text),
  };
}
