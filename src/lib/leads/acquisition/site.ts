import { claimsMentioned, readAdPlaces } from "./creative";
import { withoutMoneyPromise } from "./photo";
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

export type WebsiteProposal = {
  title: string | null;
  displayName: string | null;
  summary: string | null;
  welcome: string | null;
  colours: string[];
  imageUrls: string[];
  places: string[];
  claims: string[];
};

function hexColour(value: string) {
  const text = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toLowerCase();
  const short = text.match(/^#([0-9a-fA-F]{3})$/);
  if (!short) return null;
  const [red, green, blue] = short[1].split("");
  return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
}

function readPageColours(html: string) {
  const theme = hexColour(metaContent(html, "theme-color") ?? "");
  const counts = new Map<string, number>();
  for (const match of html.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) {
    const colour = hexColour(match[0]);
    if (!colour || colour === theme) continue;
    counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  const repeated = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .map(([colour]) => colour);
  return [theme, ...repeated].filter((colour): colour is string => Boolean(colour)).slice(0, 6);
}

function absoluteHttps(value: string, pageUrl: string) {
  try {
    const url = new URL(value, pageUrl);
    if (url.protocol !== "https:") return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function readPageImages(html: string, pageUrl: string) {
  const urls: string[] = [];
  const add = (value: string) => {
    const url = absoluteHttps(value, pageUrl);
    if (!url || urls.includes(url)) return;
    urls.push(url);
  };
  add(metaContent(html, "og:image"));
  const touch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
  if (touch?.[1]) add(touch[1]);
  for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = image[0];
    if (!/logo/i.test(tag)) continue;
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src) add(src);
  }
  return urls.slice(0, 4);
}

function displayNameFromTitle(title: string | null) {
  if (!title) return null;
  const name = title.split(/\s+[|–-]\s+/)[0]?.trim() ?? "";
  return name.slice(0, 80) || null;
}

export function readWebsiteProposal(html: string, pageUrl = "https://firm.example/"): WebsiteProposal {
  const brief = readWebsiteBrief(html);
  const summary = withoutMoneyPromise(brief.summary ?? "").slice(0, 180) || null;
  return {
    title: brief.title,
    displayName: displayNameFromTitle(brief.title),
    summary,
    welcome: summary,
    colours: readPageColours(html),
    imageUrls: readPageImages(html, pageUrl),
    places: brief.places,
    claims: brief.claims,
  };
}
