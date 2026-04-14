import { getSupabaseClient } from "../client";

const TENANT_SETTINGS_SELECT =
  "id, name, data_retention_days, soft_deleted_at, purge_after";

function requireTenantRecord<T>(data: T | null, error: unknown): T {
  if (error || !data) {
    throw (error as Error) ?? new Error("Tenant not found");
  }

  return data;
}

/**
 * Read tenant settings through RLS-scoped client access.
 */
export async function getTenantSettings(tenantId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(TENANT_SETTINGS_SELECT)
    .eq("id", tenantId)
    .maybeSingle();

  return requireTenantRecord(data, error);
}
