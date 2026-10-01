import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types";
import { readAdTargeting, type AdTargeting } from "./creative";

export async function loadAdTargeting(tenantId: string) {
  const supabase = getServiceClient("ad-targeting");
  const { data, error } = await supabase
    .from("tenants")
    .select("ad_targeting")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return readAdTargeting(data?.ad_targeting);
}

export async function saveAdTargeting(tenantId: string, targeting: AdTargeting) {
  const supabase = getServiceClient("ad-targeting-save");
  const { error } = await supabase
    .from("tenants")
    .update({
      ad_targeting: {
        places: targeting.places,
        assets: targeting.assets,
        websiteUrl: targeting.websiteUrl,
        siteSummary: targeting.siteSummary,
        sitePlaces: targeting.sitePlaces,
        siteClaims: targeting.siteClaims,
      } as Json,
    })
    .eq("id", tenantId);
  if (error) throw error;
}
