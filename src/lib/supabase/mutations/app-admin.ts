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
};
