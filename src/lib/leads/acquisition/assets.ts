import "server-only";

import { detectImageType } from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";
import type { AdAssetRecord } from "./creative";

export const AD_ASSET_MAX_BYTES = 2 * 1024 * 1024;

export function adAssetPath(id: string) {
  return `branding/ads/${id}`;
}

export function adAssetName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "image";
  const cleaned = base.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 80);
  return cleaned || "image";
}

export async function loadAdAssetBytes(tenantId: string, assets: AdAssetRecord[]) {
  if (!assets.length) return [];
  const supabase = getServiceClient("ad-asset-read");
  const images: Buffer[] = [];
  for (const asset of assets) {
    const { data, error } = await supabase.storage.from(tenantId).download(adAssetPath(asset.id));
    if (error || !data) continue;
    const bytes = Buffer.from(await data.arrayBuffer());
    if (detectImageType(bytes) === asset.contentType) images.push(bytes);
  }
  return images;
}
