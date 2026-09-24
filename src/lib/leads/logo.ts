import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types";
import { LeadBrandingSchema, type LeadBranding } from "@/lib/leads/schema";

export const FIRM_LOGO_STORAGE_PATH = "branding/logo";
export const FIRM_LOGO_MAX_BYTES = 2 * 1024 * 1024;

type ServiceClient = SupabaseClient<Database>;

export function slugifyPublicAddress(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function firmLogoPublicPath(slug: string, version?: string | number) {
  const path = `/api/public/firm-logo/${slug}`;
  return version == null || version === "" ? path : `${path}?v=${version}`;
}

export function detectImageType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function readLeadBranding(value: unknown): LeadBranding {
  const parsed = LeadBrandingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export async function resolveFirmLogoUrl(
  supabase: ServiceClient,
  tenantId: string,
  slug: string | null,
  branding: LeadBranding,
) {
  if (!slug) {
    if (branding.logoUrl?.startsWith("/api/public/firm-logo/")) {
      return { ...branding, logoUrl: "" };
    }
    return branding;
  }

  if (branding.logoUrl?.startsWith("/api/public/firm-logo/")) {
    const version = new URL(branding.logoUrl, "https://local.invalid").searchParams.get(
      "v",
    );
    return {
      ...branding,
      logoUrl: firmLogoPublicPath(slug, version ?? undefined),
    };
  }

  if (branding.logoUrl) return branding;

  const { data } = await supabase.storage.from(tenantId).list("branding", {
    limit: 20,
  });
  if (data?.some((item) => item.name === "logo")) {
    return { ...branding, logoUrl: firmLogoPublicPath(slug, Date.now()) };
  }
  return branding;
}
