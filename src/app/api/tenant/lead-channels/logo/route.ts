import {
  badRequest,
  ok,
  requireTenantManager,
  serverError,
} from "@/lib/api-utils";
import { widgetEnabled } from "@/lib/billing/plans";
import {
  detectImageType,
  FIRM_LOGO_MAX_BYTES,
  FIRM_LOGO_STORAGE_PATH,
  firmLogoPublicPath,
  readLeadBranding,
} from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

async function saveLogoUrl(
  tenantId: string,
  current: unknown,
  logoUrl: string,
) {
  const supabase = getServiceClient("lead-logo-save");
  const branding = { ...readLeadBranding(current), logoUrl } as Json;
  const { error } = await supabase
    .from("tenants")
    .update({ intake_branding: branding })
    .eq("id", tenantId);
  if (error) throw error;
  const { error: channelError } = await supabase
    .from("lead_channels")
    .update({ branding })
    .eq("tenant_id", tenantId);
  if (channelError) throw channelError;
  return branding;
}

export async function POST(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    const supabase = getServiceClient("lead-logo-upload");
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, plan, public_slug, intake_branding")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (tenantError || !tenant) throw tenantError ?? new Error("Tenant not found");
    if (!widgetEnabled(tenant.plan)) {
      return Response.json(
        { error: "Branding is part of Growth.", code: "conflict", gate: "growth" },
        { status: 409 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("Choose a logo image");
    if (file.size <= 0 || file.size > FIRM_LOGO_MAX_BYTES) {
      return badRequest("Logo must be 2 MB or smaller");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectImageType(bytes);
    if (!contentType) {
      return badRequest("Upload a PNG, JPEG, WEBP, or GIF logo");
    }

    const { error: uploadError } = await supabase.storage
      .from(tenant.id)
      .upload(FIRM_LOGO_STORAGE_PATH, new Blob([bytes], { type: contentType }), {
        contentType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const logoUrl = tenant.public_slug
      ? firmLogoPublicPath(tenant.public_slug, Date.now())
      : "";
    await saveLogoUrl(tenant.id, tenant.intake_branding, logoUrl);
    return ok({ logoUrl });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    const supabase = getServiceClient("lead-logo-delete");
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, plan, intake_branding")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (tenantError || !tenant) throw tenantError ?? new Error("Tenant not found");
    if (!widgetEnabled(tenant.plan)) {
      return Response.json(
        { error: "Branding is part of Growth.", code: "conflict", gate: "growth" },
        { status: 409 },
      );
    }

    const { error: removeError } = await supabase.storage
      .from(tenant.id)
      .remove([FIRM_LOGO_STORAGE_PATH]);
    if (removeError) throw removeError;

    await saveLogoUrl(tenant.id, tenant.intake_branding, "");
    return ok({ logoUrl: "" });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
