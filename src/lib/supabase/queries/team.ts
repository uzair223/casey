import { getServiceClient } from "../server";
import type { ProfileWithEmail } from "@/types";

/**
 * Get all team members for a tenant (with emails from auth.users)
 * SERVER ONLY - Requires service role to access admin.getUserById
 * This should only be called from server-side code or API routes
 */
export const SERVERONLY_getTeamMembers = async (
  tenant_id: string,
): Promise<ProfileWithEmail[]> => {
  const supabase = getServiceClient("SERVERONLY_getTeamMembers");

  const { data: members, error } = await supabase
    .from("profiles")
    .select("user_id, tenant_id, display_name, role, created_at")
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
        ...member,
        email: userInfo?.user?.email ?? null,
      };
    }),
  );

  return results as ProfileWithEmail[];
};
