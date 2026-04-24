import { getSupabaseClient } from "../client";

export const revokeTenantAccess = async (tenantId: string): Promise<void> => {
  const supabase = getSupabaseClient();

  const { error: invitesError } = await supabase
    .from("invites")
    .delete()
    .eq("tenant_id", tenantId)
    .is("accepted_at", null);

  if (invitesError) {
    throw invitesError;
  }

  const { error: membersError } = await supabase
    .from("profiles")
    .delete()
    .eq("tenant_id", tenantId);

  if (membersError) {
    throw membersError;
  }

  const { error: tenantError } = await supabase.rpc("soft_delete_tenant", {
    tenant_id_param: tenantId,
  });

  if (tenantError) {
    throw tenantError;
  }
};

export const restoreTenantAccess = async (tenantId: string): Promise<void> => {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc("restore_tenant", {
    tenant_id_param: tenantId,
  });

  if (error) {
    throw error;
  }
};
