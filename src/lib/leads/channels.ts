import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import { widgetEnabled } from "@/lib/billing/plans";
import { readLeadBranding } from "./logo";
import {
  parseLeadTypeConfig,
  type LeadBranding,
} from "./schema";

export type PublicLeadChannel = {
  channelId: string;
  tenantId: string;
  tenantName: string;
  leadTypeId: string;
  leadTypeName: string;
  publicKey: string;
  enabled: boolean;
  widget: boolean;
  branding: LeadBranding;
  welcome: string;
};

function publicBranding(
  plan: string | null,
  tenantBranding: unknown,
  channelBranding: unknown,
  leadTypeBranding?: LeadBranding,
): LeadBranding {
  if (!widgetEnabled(plan)) {
    return {};
  }
  return {
    ...(leadTypeBranding ?? {}),
    ...readLeadBranding(channelBranding),
    ...readLeadBranding(tenantBranding),
  };
}

export async function getChannelByKey(publicKey: string) {
  const supabase = getServiceClient("lead-channel-by-key");
  const { data, error } = await supabase
    .from("lead_channels")
    .select(
      "id, tenant_id, lead_type_id, public_key, enabled, branding, tenants(name, plan, public_slug, intake_branding), case_templates(name, qualification_slots, participant_roles, outreach_template, decline_reasons, branding, status)",
    )
    .eq("public_key", publicKey)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.enabled) return null;

  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
  const leadType = Array.isArray(data.case_templates)
    ? data.case_templates[0]
    : data.case_templates;
  if (!tenant || !leadType || leadType.status !== "published") return null;

  const config = parseLeadTypeConfig(leadType);
  const branding = publicBranding(
    tenant.plan,
    tenant.intake_branding,
    data.branding,
    config.branding,
  );

  return {
    channelId: data.id,
    tenantId: data.tenant_id,
    tenantName: branding.displayName || tenant.name,
    leadTypeId: data.lead_type_id,
    leadTypeName: leadType.name,
    publicKey: data.public_key,
    enabled: data.enabled,
    widget: widgetEnabled(tenant.plan),
    plan: tenant.plan,
    branding,
    welcome:
      (widgetEnabled(tenant.plan) ? branding.welcome : undefined) ||
      `Tell ${tenant.name} what happened. Casey will ask for the details they need.`,
    config,
  };
}

export async function listChannelsForSlug(slug: string) {
  const supabase = getServiceClient("lead-channels-by-slug");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, plan, public_slug, intake_branding")
    .ilike("public_slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) return null;

  const { data: channels, error: channelError } = await supabase
    .from("lead_channels")
    .select(
      "id, public_key, enabled, branding, lead_type_id, case_templates(name, status, qualification_slots, participant_roles, outreach_template, decline_reasons, branding)",
    )
    .eq("tenant_id", tenant.id)
    .eq("enabled", true);
  if (channelError) throw channelError;

  const published = (channels ?? []).flatMap((channel) => {
    const leadType = Array.isArray(channel.case_templates)
      ? channel.case_templates[0]
      : channel.case_templates;
    if (!leadType || leadType.status !== "published") return [];
    return [
      {
        channelId: channel.id,
        publicKey: channel.public_key,
        leadTypeId: channel.lead_type_id,
        leadTypeName: leadType.name,
        config: parseLeadTypeConfig(leadType),
        branding: publicBranding(
          tenant.plan,
          tenant.intake_branding,
          channel.branding,
        ),
      },
    ];
  });

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    plan: tenant.plan,
    widget: widgetEnabled(tenant.plan),
    channels: published,
  };
}
