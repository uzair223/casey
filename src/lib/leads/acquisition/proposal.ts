import "server-only";

import { detectImageType } from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";
import { AD_ASSET_MAX_BYTES, adAssetPath } from "./assets";
import type { AdAssetRecord } from "./creative";
import { websiteUrlError } from "./site";

export function proposedImagePath(id: string) {
  return `branding/proposed/${id}`;
}

export async function storeProposalImages(tenantId: string, urls: string[]) {
  const supabase = getServiceClient("ad-proposal-images");
  const images: AdAssetRecord[] = [];
  for (const url of urls) {
    if (images.length === 4 || websiteUrlError(url)) continue;
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength <= 0 || bytes.byteLength > AD_ASSET_MAX_BYTES) continue;
      const contentType = detectImageType(bytes);
      if (contentType !== "image/png" && contentType !== "image/jpeg") continue;
      const id = crypto.randomUUID();
      const { error } = await supabase.storage.from(tenantId).upload(
        proposedImagePath(id),
        new Blob([new Uint8Array(bytes)], { type: contentType }),
        { contentType, upsert: true },
      );
      if (error) continue;
      images.push({ id, name: "From the website", contentType });
    } catch {
      continue;
    }
  }
  return images;
}

export async function adoptProposalImages(tenantId: string, images: AdAssetRecord[]) {
  const supabase = getServiceClient("ad-proposal-adopt");
  for (const image of images) {
    const { data, error } = await supabase.storage.from(tenantId).download(proposedImagePath(image.id));
    if (error || !data) continue;
    const bytes = Buffer.from(await data.arrayBuffer());
    await supabase.storage.from(tenantId).upload(
      adAssetPath(image.id),
      new Blob([new Uint8Array(bytes)], { type: image.contentType }),
      { contentType: image.contentType, upsert: true },
    );
  }
}
