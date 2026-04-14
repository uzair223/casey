import { getSupabaseClient } from "../client";

const TENANT_SETTINGS_SELECT =
  "id, name, data_retention_days, soft_deleted_at, purge_after";

function requireTenantRecord<T>(data: T | null, error: unknown): T {
  if (error || !data) {
    throw (error as Error) ?? new Error("Tenant not found");
  }

  return data;
}

export async function updateTenantSettings(
  tenantId: string,
  input: { name?: string; dataRetentionDays?: number },
) {
  const supabase = getSupabaseClient();

  const updatePayload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }
  if (input.dataRetentionDays !== undefined) {
    updatePayload.data_retention_days = input.dataRetentionDays;
  }

  const { data, error } = await supabase
    .from("tenants")
    .update(updatePayload)
    .eq("id", tenantId)
    .select(TENANT_SETTINGS_SELECT)
    .single();

  return requireTenantRecord(data, error);
}

export async function softDeleteTenant(tenantId: string) {
  const supabase = getSupabaseClient();

  const { error: rpcError } = await supabase.rpc("soft_delete_tenant", {
    tenant_id_param: tenantId,
  });

  if (rpcError) {
    throw rpcError;
  }

  const { data, error } = await supabase
    .from("tenants")
    .select(TENANT_SETTINGS_SELECT)
    .eq("id", tenantId)
    .maybeSingle();

  // After soft-delete, RLS/policies may hide the tenant row from the client.
  // In that case `data` is null and the operation should still be considered successful.
  if (error) {
    throw error;
  }

  return data;
}
