import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { assertServerOnly } from "@/lib/utils";
import { UserRole } from "@/lib/types";

type UserProfile = {
  tenant_id: string | null;
  role: UserRole;
  display_name?: string | null;
};

/**
 * Get current user's own profile
 * Client-callable: RLS ensures users can only read their own profile
 */
export async function getCurrentUserProfile(
  user_id: string,
): Promise<UserProfile> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role, display_name")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      tenant_id: null,
      role: "user",
      display_name: null,
    };
  }

  return data as UserProfile;
}

/**
 * Get user profile by user ID
 * SERVER ONLY - Used by API routes for authentication
 */
export async function getUserProfile(
  user_id: string,
): Promise<UserProfile | null> {
  assertServerOnly("getUserProfile");
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role, display_name")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserProfile | null;
}
