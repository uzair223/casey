import { InviteWithTenantName } from "@/types";
import { getSupabaseClient } from "../client";

/**
 * Get and validate an invite by token
 */
export const getInviteByToken = async (
  token: string,
  unusedOnly: boolean = true,
): Promise<InviteWithTenantName | null> => {
  const supabase = getSupabaseClient();

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    return null;
  }

  if (
    unusedOnly &&
    (invite.accepted_at || new Date(invite.expires_at) < new Date())
  ) {
    return null;
  }

  let tenant_name = null;
  if (invite.tenant_id) {
    const { data } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", invite.tenant_id)
      .maybeSingle();
    tenant_name = data?.name || null;
  }

  return { ...invite, tenant_name };
};

export const getInvites = async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};
