import "server-only";

import { env } from "@/lib/env";
import {
  getCloudflareAiGatewayId,
  getCloudflareAiRunUrl,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";
import { detectImageType } from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";
import { logServerEvent } from "@/lib/observability/logger";
import { fitReferenceImage } from "./image-fit";
import { readGeneratedImage } from "./photo";

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export function generatedPhotoPath(id: string) {
  return `branding/generated/${id}`;
}

export async function generateAdPhoto(prompt: string, references: Buffer[] = []) {
  if (!isCloudflareAiConfigured()) return null;
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", "1024");
  form.append("height", "1024");
  let attached = 0;
  for (const reference of references) {
    if (attached === 4) break;
    const fitted = fitReferenceImage(reference);
    if (!fitted) continue;
    const type = detectImageType(fitted) === "image/jpeg" ? "image/jpeg" : "image/png";
    form.append(
      `input_image_${attached}`,
      new Blob([new Uint8Array(fitted)], { type }),
      `reference-${attached}.${type === "image/jpeg" ? "jpg" : "png"}`,
    );
    attached += 1;
  }
  try {
    const response = await fetch(`${getCloudflareAiRunUrl()}/${MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_AI_API_TOKEN}`,
        "cf-aig-gateway-id": getCloudflareAiGatewayId(),
      },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok || bytes.byteLength > 8_000_000) {
      await logServerEvent("warn", "ads.photo.failed", { status: response.status });
      return null;
    }
    return readGeneratedImage(bytes, response.headers.get("content-type") ?? "");
  } catch (error) {
    await logServerEvent("warn", "ads.photo.failed", { error });
    return null;
  }
}

export async function loadGeneratedPhoto(tenantId: string, id: string) {
  const supabase = getServiceClient("ad-photo-read");
  const { data, error } = await supabase.storage.from(tenantId).download(generatedPhotoPath(id));
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  const type = detectImageType(bytes);
  if (type !== "image/png" && type !== "image/jpeg") return null;
  return bytes;
}

export async function storeGeneratedPhoto(tenantId: string, id: string, bytes: Buffer) {
  const type = detectImageType(bytes);
  if (type !== "image/png" && type !== "image/jpeg") return false;
  const supabase = getServiceClient("ad-photo-save");
  const { error } = await supabase.storage.from(tenantId).upload(
    generatedPhotoPath(id),
    new Blob([new Uint8Array(bytes)], { type }),
    { contentType: type, upsert: true },
  );
  return !error;
}
