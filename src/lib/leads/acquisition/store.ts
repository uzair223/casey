import "server-only";

import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

export type AdProvider = "google" | "meta";

export type AdAccountRow = {
  id: string;
  tenant_id: string;
  provider: string;
  external_account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  details: Json;
  spend_by_click: Json;
  spend_refreshed_at: string | null;
};

export type CampaignRow = {
  id: string;
  tenant_id: string;
  provider: string;
  external_campaign_id: string | null;
  status: string;
  monthly_budget_gbp: number | null;
  details: Json;
  last_error: string | null;
};

export function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function textField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listAdAccounts(tenantId: string) {
  const supabase = getServiceClient("lead-ad-accounts");
  const { data, error } = await supabase
    .from("lead_ad_accounts")
    .select(
      "id, tenant_id, provider, external_account_id, access_token, refresh_token, expires_at, details, spend_by_click, spend_refreshed_at",
    )
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []) as AdAccountRow[];
}

export async function saveAdAccount(params: {
  tenantId: string;
  provider: AdProvider;
  externalAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  details: Record<string, unknown>;
}) {
  const supabase = getServiceClient("lead-ad-account-save");
  const { error } = await supabase.from("lead_ad_accounts").upsert(
    {
      tenant_id: params.tenantId,
      provider: params.provider,
      external_account_id: params.externalAccountId,
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      expires_at: params.expiresAt,
      details: params.details as Json,
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) throw error;
}

export async function updateAdAccount(
  id: string,
  patch: {
    access_token?: string;
    expires_at?: string | null;
    spend_by_click?: Json;
    spend_refreshed_at?: string;
    details?: Json;
  },
) {
  const supabase = getServiceClient("lead-ad-account-update");
  const { error } = await supabase.from("lead_ad_accounts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAdAccount(tenantId: string, provider: AdProvider) {
  const supabase = getServiceClient("lead-ad-account-delete");
  const { error } = await supabase
    .from("lead_ad_accounts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function listCampaigns(tenantId: string) {
  const supabase = getServiceClient("lead-campaigns");
  const { data, error } = await supabase
    .from("lead_campaigns")
    .select(
      "id, tenant_id, provider, external_campaign_id, status, monthly_budget_gbp, details, last_error",
    )
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []) as CampaignRow[];
}

export async function saveCampaign(params: {
  tenantId: string;
  provider: AdProvider;
  externalCampaignId: string | null;
  status: "live" | "paused";
  monthlyBudgetGbp: number;
  details: Record<string, unknown>;
  lastError: string | null;
}) {
  const supabase = getServiceClient("lead-campaign-save");
  const { error } = await supabase.from("lead_campaigns").upsert(
    {
      tenant_id: params.tenantId,
      provider: params.provider,
      external_campaign_id: params.externalCampaignId,
      status: params.status,
      monthly_budget_gbp: params.monthlyBudgetGbp,
      details: params.details as Json,
      last_error: params.lastError,
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) throw error;
}

export type CrmConnectionRow = {
  id: string;
  tenant_id: string;
  provider: string;
  webhook_url: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  external_account_id: string | null;
  region: string | null;
};

export async function listCrmConnections(tenantId: string) {
  const supabase = getServiceClient("crm-connections");
  const { data, error } = await supabase
    .from("crm_connections")
    .select(
      "id, tenant_id, provider, webhook_url, access_token, refresh_token, expires_at, external_account_id, region",
    )
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []) as CrmConnectionRow[];
}

export async function saveCrmConnection(params: {
  tenantId: string;
  provider: "clio" | "webhook";
  webhookUrl?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  externalAccountId?: string | null;
  region?: string | null;
}) {
  const supabase = getServiceClient("crm-connection-save");
  const { error } = await supabase.from("crm_connections").upsert(
    {
      tenant_id: params.tenantId,
      provider: params.provider,
      webhook_url: params.webhookUrl ?? null,
      access_token: params.accessToken ?? null,
      refresh_token: params.refreshToken ?? null,
      expires_at: params.expiresAt ?? null,
      external_account_id: params.externalAccountId ?? null,
      region: params.region ?? null,
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) throw error;
}

export async function deleteCrmConnection(tenantId: string, provider: "clio" | "webhook") {
  const supabase = getServiceClient("crm-connection-delete");
  const { error } = await supabase
    .from("crm_connections")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("provider", provider);
  if (error) throw error;
}

export async function updateCrmTokens(
  id: string,
  patch: { access_token: string; refresh_token?: string | null; expires_at: string | null },
) {
  const supabase = getServiceClient("crm-connection-tokens");
  const { error } = await supabase.from("crm_connections").update(patch).eq("id", id);
  if (error) throw error;
}
