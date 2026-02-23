import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { assertServerOnly } from "@/lib/utils";

export type TeamMember = {
  user_id: string;
  role: string;
  email: string | null;
};

export type ProfileWithEmail = {
  user_id: string;
  tenant_id: string | null;
  role: string;
  email: string | null;
  created_at: string;
};

/**
 * Get all team members for a tenant (with emails from auth.users)
 * SERVER ONLY - Requires service role to access admin.getUserById
 * This should only be called from server-side code or API routes
 */
export const getTeamMembers = async (
  tenant_id: string,
): Promise<ProfileWithEmail[]> => {
  assertServerOnly("getTeamMembers");
  const supabase = getServiceClient();

  const { data: members, error } = await supabase
    .from("profiles")
    .select("user_id, tenant_id, role, created_at")
    .eq("tenant_id", tenant_id);

  if (error) {
    throw error;
  }

  // Fetch emails using admin API (requires service role)
  const results = await Promise.all(
    (members ?? []).map(async (member) => {
      const { data: userInfo } = await supabase.auth.admin.getUserById(
        member.user_id,
      );

      return {
        user_id: member.user_id,
        tenant_id: member.tenant_id,
        role: member.role,
        email: userInfo?.user?.email ?? null,
        created_at: member.created_at,
      };
    }),
  );

  return results;
};

/**
 * Update a user's role within their tenant
 * Client-callable: RLS ensures only tenant admins can change roles
 */
export const updateUserRole = async (
  user_id: string,
  newRole: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  const supabase = getSupabaseClient();

  // Validate role
  const validRoles = ["tenant_admin", "solicitor", "paralegal"];
  if (!validRoles.includes(newRole)) {
    throw new Error("Invalid role");
  }

  // Get target user's current profile
  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user_id)
    .maybeSingle();

  if (targetError || !targetProfile) {
    throw new Error("User not found");
  }

  // Verify target user is in the same tenant
  if (targetProfile.tenant_id !== tenant_id) {
    throw new Error("User not in your tenant");
  }

  // Cannot modify other tenant_admins
  if (targetProfile.role === "tenant_admin" && user_id !== requestinguser_id) {
    throw new Error("Cannot modify other tenant admins");
  }

  // Update role
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("user_id", user_id);

  if (updateError) {
    throw updateError;
  }
};

/**
 * Remove a user from a tenant
 * Client-callable: RLS ensures only tenant admins can remove members
 */
export const removeTeamMember = async (
  user_id: string,
  tenant_id: string,
  requestinguser_id: string,
): Promise<void> => {
  const supabase = getSupabaseClient();

  // Cannot remove yourself
  if (user_id === requestinguser_id) {
    throw new Error("Cannot remove yourself");
  }

  // Get target user's current profile
  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", user_id)
    .maybeSingle();

  if (targetError || !targetProfile) {
    throw new Error("User not found");
  }

  // Verify target user is in the same tenant
  if (targetProfile.tenant_id !== tenant_id) {
    throw new Error("User not in your tenant");
  }

  // Cannot remove other tenant_admins
  if (targetProfile.role === "tenant_admin") {
    throw new Error("Cannot remove other tenant admins");
  }

  // Delete the profile (user loses access to this tenant)
  const { error: deleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("user_id", user_id);

  if (deleteError) {
    throw deleteError;
  }
};
