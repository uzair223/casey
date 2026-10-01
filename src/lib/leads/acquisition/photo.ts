import { detectImageType } from "@/lib/leads/logo";

const MONEY_PROMISE = /\b(compensation|settlement|payout|pay\s*out)\b/i;

export function withoutMoneyPromise(value: string) {
  const kept = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !MONEY_PROMISE.test(sentence));
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

export function chooseAdImageSource(hasUpload: boolean, hasPhoto: boolean) {
  if (hasUpload) return "upload" as const;
  if (hasPhoto) return "photo" as const;
  return "card" as const;
}

function sceneFor(claim: string) {
  const name = claim.toLowerCase();
  if (name.includes("road")) return "a quiet UK street in daylight";
  if (name.includes("work")) return "a tidy workplace in daylight";
  if (name.includes("public")) return "a public pavement in a UK town";
  if (name.includes("medical") || name.includes("treatment")) return "a calm clinic waiting room";
  if (name.includes("housing") || name.includes("home")) return "the outside of a UK home";
  return "a calm UK high street";
}

export function adPhotoPrompt(params: {
  firmName: string;
  claim: string;
  places: string[];
  summary?: string | null;
  background: string;
}) {
  const place = params.places[0]?.trim();
  const summary = withoutMoneyPromise(params.summary ?? "").slice(0, 180);
  const lines = [
    `A calm photograph in the UK for ${params.firmName.trim() || "a law firm"}.`,
    `Scene: ${sceneFor(params.claim)}.`,
    place ? `Setting: ${place}.` : "Setting: a UK town.",
    summary ? `Mood: ${summary}` : "",
    `Colour mood ${params.background}, with no letters and no numbers painted in the picture.`,
    "No readable text, no logos, no watermarks, no injured people, and no graphic injury.",
  ];
  return lines.filter(Boolean).join(" ");
}

function imageFromBase64(value: string) {
  const cleaned = value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\s/g, "");
  if (cleaned.length < 16) return null;
  const bytes = Buffer.from(cleaned, "base64");
  const type = detectImageType(bytes);
  if (type !== "image/png" && type !== "image/jpeg") return null;
  return bytes;
}

function imageField(value: unknown): Buffer | null {
  if (typeof value === "string") return imageFromBase64(value);
  if (!value || typeof value !== "object") return null;
  const record = value as { image?: unknown; result?: unknown };
  return imageField(record.image) ?? imageField(record.result);
}

export function readGeneratedImage(body: Uint8Array, contentType: string) {
  const type = contentType.toLowerCase();
  if (type.includes("image/png") || type.includes("image/jpeg")) {
    const detected = detectImageType(body);
    if (detected === "image/png" || detected === "image/jpeg") return Buffer.from(body);
  }
  const text = Buffer.from(body).toString("utf8").trim();
  if (!text.startsWith("{")) return null;
  try {
    return imageField(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}
