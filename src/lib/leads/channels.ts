import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import { widgetEnabled } from "@/lib/billing/plans";
import { readLeadBranding } from "./logo";
import {
  parseLeadTypeConfig,
  resolveLeadWelcome,
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
      "id, tenant_id, lead_type_id, public_key, enabled, branding, tenants(name, plan, public_slug, intake_branding), statement_config_templates!lead_channels_lead_type_id_fkey(name, qualification_slots, participant_roles, outreach_template, decline_reasons, branding, status)",
    )
    .eq("public_key", publicKey)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.enabled) return null;

  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
  const leadType = Array.isArray(data.statement_config_templates)
    ? data.statement_config_templates[0]
    : data.statement_config_templates;
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
    welcome: resolveLeadWelcome({
      leadTypeName: leadType.name,
      leadTypeWelcome: readLeadBranding(data.branding).welcome,
    }),
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
      "id, public_key, enabled, branding, lead_type_id, statement_config_templates!lead_channels_lead_type_id_fkey(name, status, qualification_slots, participant_roles, outreach_template, decline_reasons, branding)",
    )
    .eq("tenant_id", tenant.id)
    .eq("enabled", true);
  if (channelError) throw channelError;

  const published = (channels ?? []).flatMap((channel) => {
    const leadType = Array.isArray(channel.statement_config_templates)
      ? channel.statement_config_templates[0]
      : channel.statement_config_templates;
    if (!leadType || leadType.status !== "published") return [];
    return [
      {
        channelId: channel.id,
        publicKey: channel.public_key,
        leadTypeId: channel.lead_type_id,
        leadTypeName: leadType.name,
        config: parseLeadTypeConfig(leadType),
        welcome: resolveLeadWelcome({
          leadTypeName: leadType.name,
          leadTypeWelcome: readLeadBranding(channel.branding).welcome,
        }),
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

export type PublishedLeadChannel = {
  channelId: string;
  leadTypeId: string;
  leadTypeName: string;
  config: ReturnType<typeof parseLeadTypeConfig>;
};

export async function listPublishedLeadChannels(
  tenantId: string,
): Promise<PublishedLeadChannel[]> {
  const supabase = getServiceClient("lead-channels-published");
  const { data, error } = await supabase
    .from("lead_channels")
    .select(
      "id, lead_type_id, enabled, statement_config_templates!lead_channels_lead_type_id_fkey(name, status, qualification_slots, participant_roles, outreach_template, decline_reasons, branding)",
    )
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  if (error) throw error;

  const seen = new Set<string>();
  return (data ?? []).flatMap((channel) => {
    const leadType = Array.isArray(channel.statement_config_templates)
      ? channel.statement_config_templates[0]
      : channel.statement_config_templates;
    if (!channel.enabled || !leadType || leadType.status !== "published") return [];
    if (seen.has(channel.lead_type_id)) return [];
    seen.add(channel.lead_type_id);
    return [
      {
        channelId: channel.id,
        leadTypeId: channel.lead_type_id,
        leadTypeName: leadType.name,
        config: parseLeadTypeConfig(leadType),
      },
    ];
  });
}
