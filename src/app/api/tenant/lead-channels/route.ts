import { badRequest, ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { widgetEnabled } from "@/lib/billing/plans";
import { LeadBrandingSchema } from "@/lib/leads/schema";
import { generateSecureToken } from "@/lib/security";
import { getServiceClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

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
        .select("name, plan, public_slug")
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
      publicSlug: tenant?.public_slug ?? null,
      premium,
      hostedUrl: tenant?.public_slug
        ? `https://${tenant.public_slug}.caseyhq.co.uk`
        : null,
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
      .select("id, name, plan, public_slug")
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
    const branding = body?.branding
      ? LeadBrandingSchema.parse(body.branding)
      : undefined;

    let leadTypeId = body?.leadTypeId;
    if (!leadTypeId) {
      const { data: seeded } = await supabase
        .from("case_templates")
        .select("id")
        .eq("template_scope", "global")
        .eq("public_slug", "personal-injury")
        .maybeSingle();
      leadTypeId = seeded?.id;
    }
    if (!leadTypeId) return badRequest("Choose a lead type");

    const slug = slugify(body?.publicSlug || tenant.public_slug || tenant.name);
    if (!slug) return badRequest("Choose a public address");
    if (!tenant.public_slug) {
      const { error: slugError } = await supabase
        .from("tenants")
        .update({ public_slug: slug })
        .eq("id", tenant.id);
      if (slugError) throw slugError;
    }

    const { data: existing } = await supabase
      .from("lead_channels")
      .select("id, public_key")
      .eq("tenant_id", tenant.id)
      .eq("lead_type_id", leadTypeId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("lead_channels")
        .update({
          enabled: body?.enabled ?? true,
          ...(branding ? { branding } : {}),
        })
        .eq("id", existing.id);
      if (error) throw error;
      return ok({ id: existing.id, publicKey: existing.public_key });
    }

    const publicKey = generateSecureToken(24);
    const { data, error } = await supabase
      .from("lead_channels")
      .insert({
        tenant_id: tenant.id,
        lead_type_id: leadTypeId,
        public_key: publicKey,
        enabled: body?.enabled ?? true,
        branding: branding ?? {},
      })
      .select("id, public_key")
      .single();
    if (error) throw error;
    return ok({ id: data.id, publicKey: data.public_key });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}
