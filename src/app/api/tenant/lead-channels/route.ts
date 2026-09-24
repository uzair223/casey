import {
  badRequest,
  conflict,
  ok,
  requireTenantManager,
  serverError,
} from "@/lib/api-utils";
import { widgetEnabled } from "@/lib/billing/plans";
import { firmPageUrl } from "@/lib/firm-page-host";
import { LeadBrandingSchema } from "@/lib/leads/schema";
import {
  readLeadBranding,
  resolveFirmLogoUrl,
  slugifyPublicAddress,
} from "@/lib/leads/logo";
import { generateSecureToken } from "@/lib/security";
import { getServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Json } from "@/types";

export async function GET(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    const supabase = getServiceClient("lead-channels-list");
    const [
      { data: tenant, error: tenantError },
      { data: channels, error },
      { data: leadTypes, error: leadTypeError },
    ] = await Promise.all([
      supabase
        .from("tenants")
        .select("name, plan, public_slug, intake_branding")
        .eq("id", auth.tenantId)
        .maybeSingle(),
      supabase
        .from("lead_channels")
        .select("id, public_key, enabled, branding, lead_type_id, case_templates(name)")
        .eq("tenant_id", auth.tenantId),
      supabase
        .from("case_templates")
        .select("id, name, public_slug")
        .eq("template_scope", "global")
        .eq("status", "published")
        .not("public_slug", "is", null)
        .order("name"),
    ]);
    if (tenantError || error || leadTypeError) {
      throw tenantError ?? error ?? leadTypeError;
    }

    const premium = widgetEnabled(tenant?.plan);
    return ok({
      tenantName: tenant?.name ?? "",
      publicSlug: tenant?.public_slug ?? null,
      premium,
      branding: premium ? readLeadBranding(tenant?.intake_branding) : {},
      hostedUrl: tenant?.public_slug ? firmPageUrl(tenant.public_slug) : null,
      localPath: tenant?.public_slug ? `/q/${tenant.public_slug}` : null,
      leadTypes: (leadTypes ?? []).map((leadType) => ({
        id: leadType.id,
        name: leadType.name,
        publicSlug: leadType.public_slug,
      })),
      channels: (channels ?? []).map((channel) => {
        const leadType = Array.isArray(channel.case_templates)
          ? channel.case_templates[0]
          : channel.case_templates;
        return {
          id: channel.id,
          leadTypeId: channel.lead_type_id,
          leadTypeName: leadType?.name ?? "Lead type",
          enabled: channel.enabled,
          publicKey: channel.public_key,
          branding: premium ? channel.branding : {},
          snippet: `<script src="${env.NEXT_PUBLIC_BASE_URL}/widget.js" data-key="${channel.public_key}"></script>`,
        };
      }),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireTenantManager(request);
    const body = (await request.json().catch(() => null)) as {
      leadTypeId?: string;
      publicSlug?: string;
      branding?: unknown;
      enabled?: boolean;
    } | null;

    const supabase = getServiceClient("lead-channels-save");
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, plan, public_slug, intake_branding")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (tenantError || !tenant) throw tenantError ?? new Error("Tenant not found");

    const premium = widgetEnabled(tenant.plan);
    if (body?.branding && !premium) {
      return Response.json(
        { error: "Branding is part of Growth.", code: "conflict", gate: "growth" },
        { status: 409 },
      );
    }

    let slug = tenant.public_slug;
    if (typeof body?.publicSlug === "string") {
      const next = slugifyPublicAddress(body.publicSlug);
      if (!next) return badRequest("Choose a public address");
      if (next !== slug) {
        const { data: taken, error: takenError } = await supabase
          .from("tenants")
          .select("id")
          .ilike("public_slug", next)
          .neq("id", tenant.id)
          .maybeSingle();
        if (takenError) throw takenError;
        if (taken) return conflict("That public address is already in use");

        const { error: slugError } = await supabase
          .from("tenants")
          .update({ public_slug: next })
          .eq("id", tenant.id);
        if (slugError) {
          if (slugError.code === "23505") {
            return conflict("That public address is already in use");
          }
          throw slugError;
        }
        slug = next;
      }
    }

    let branding = readLeadBranding(tenant.intake_branding);
    if (body?.branding) {
      branding = LeadBrandingSchema.parse(body.branding);
    }
    branding = await resolveFirmLogoUrl(supabase, tenant.id, slug, branding);
    const brandingJson = branding as Json;

    const { error: brandingError } = await supabase
      .from("tenants")
      .update({ intake_branding: brandingJson })
      .eq("id", tenant.id);
    if (brandingError) throw brandingError;

    const { error: channelBrandingError } = await supabase
      .from("lead_channels")
      .update({ branding: brandingJson })
      .eq("tenant_id", tenant.id);
    if (channelBrandingError) throw channelBrandingError;

    if (!body?.leadTypeId) {
      return ok({
        publicSlug: slug,
        branding: premium ? branding : {},
        hostedUrl: slug ? firmPageUrl(slug) : null,
        localPath: slug ? `/q/${slug}` : null,
      });
    }

    const { data: existing } = await supabase
      .from("lead_channels")
      .select("id, public_key")
      .eq("tenant_id", tenant.id)
      .eq("lead_type_id", body.leadTypeId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("lead_channels")
        .update({
          enabled: body.enabled ?? true,
          branding: brandingJson,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return ok({ id: existing.id, publicKey: existing.public_key, publicSlug: slug });
    }

    const publicKey = generateSecureToken(24);
    const { data, error } = await supabase
      .from("lead_channels")
      .insert({
        tenant_id: tenant.id,
        lead_type_id: body.leadTypeId,
        public_key: publicKey,
        enabled: body.enabled ?? true,
        branding: brandingJson,
      })
      .select("id, public_key")
      .single();
    if (error) throw error;
    return ok({ id: data.id, publicKey: data.public_key, publicSlug: slug });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
