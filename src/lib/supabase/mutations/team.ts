import { getSupabaseClient } from "../client";

const TEAM_EDITABLE_ROLES = ["tenant_admin", "solicitor", "paralegal"];

async function getTenantMemberProfile(
  userId: string,
  tenantId: string,
): Promise<{ role: string; tenant_id: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("User not found");
  }

  if (!data.tenant_id) {
    throw new Error("User not assigned to a tenant");
  }

  if (data.tenant_id !== tenantId) {
    throw new Error("User not in your tenant");
  }

  return {
    tenant_id: data.tenant_id,
    role: data.role,
  };
}

export const updateUserRole = async (
  user_id: string,
  newRole: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  const supabase = getSupabaseClient();

  if (!TEAM_EDITABLE_ROLES.includes(newRole)) {
    throw new Error("Invalid role");
  }

  const targetProfile = await getTenantMemberProfile(user_id, tenant_id);

  if (targetProfile.role === "tenant_admin" && user_id !== requestinguser_id) {
    throw new Error("Cannot modify other tenant admins");
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("user_id", user_id);

  if (updateError) {
    throw updateError;
  }
};

export const removeTeamMember = async (
  user_id: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  const supabase = getSupabaseClient();

  if (user_id === requestinguser_id) {
    throw new Error("Cannot remove yourself");
  }

  const targetProfile = await getTenantMemberProfile(user_id, tenant_id);

  if (targetProfile.role === "tenant_admin") {
    throw new Error("Cannot remove other tenant admins");
  }

  const { error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("user_id", user_id);

  if (deleteError) {
    throw deleteError;
  }
};
