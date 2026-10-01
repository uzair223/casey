import { badRequest, conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { AD_ASSET_MAX_BYTES, adAssetName, adAssetPath } from "@/lib/leads/acquisition/assets";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { readAdAssets } from "@/lib/leads/acquisition/creative";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { loadAdTargeting, saveAdTargeting } from "@/lib/leads/acquisition/targeting";
import { widgetEnabled } from "@/lib/billing/plans";
import { detectImageType } from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";

async function growthTenant(tenantId: string) {
  const supabase = getServiceClient("ad-assets");
  const { data, error } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!widgetEnabled(data?.plan)) {
    throw new ProviderError("Running campaigns is part of Growth.");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    await growthTenant(auth.tenantId);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Choose an image.");
    if (file.size <= 0 || file.size > AD_ASSET_MAX_BYTES) {
      return badRequest("Images must be 2 MB or smaller.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectImageType(bytes);
    if (contentType !== "image/png" && contentType !== "image/jpeg") {
      return badRequest("Upload a PNG or JPEG.");
    }
    const current = await loadAdTargeting(auth.tenantId);
    if (current.assets.length >= 6) {
      return conflict("Casey keeps up to 6 images for the ads.");
    }
    const id = crypto.randomUUID();
    const supabase = getServiceClient("ad-asset-upload");
    const { error: uploadError } = await supabase.storage
      .from(auth.tenantId)
      .upload(adAssetPath(id), new Blob([bytes], { type: contentType }), { contentType, upsert: false });
    if (uploadError) throw uploadError;
    const asset = { id, name: adAssetName(file.name), contentType };
    try {
      await saveAdTargeting(auth.tenantId, {
        ...current,
        assets: readAdAssets([...current.assets, asset]),
      });
    } catch (error) {
      await supabase.storage.from(auth.tenantId).remove([adAssetPath(id)]);
      throw error;
    }
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    await growthTenant(auth.tenantId);
    const body = (await request.json().catch(() => null)) as { id?: string } | null;
    const current = await loadAdTargeting(auth.tenantId);
    const asset = current.assets.find((item) => item.id === body?.id);
    if (!asset) return badRequest("Choose an image to remove.");
    const supabase = getServiceClient("ad-asset-delete");
    await supabase.storage.from(auth.tenantId).remove([adAssetPath(asset.id)]);
    await saveAdTargeting(auth.tenantId, {
      ...current,
      assets: current.assets.filter((item) => item.id !== asset.id),
    });
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}
