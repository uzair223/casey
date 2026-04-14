import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { UserRole, UserProfile } from "@/types";

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
    .select("tenant_id, role, display_name, tenants(name)")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      tenant_id: null,
      tenant_name: null,
      role: "user",
      display_name: null,
    };
  }

  return {
    tenant_id: data.tenant_id,
    tenant_name:
      (data as { tenants?: { name?: string | null } | null }).tenants?.name ??
      null,
    role: data.role as UserRole,
    display_name: data.display_name,
  };
}

/**
 * Get user profile by user ID
 * SERVER ONLY - Used by API routes for authentication
 */
export async function SERVERONLY_getUserProfile(
  user_id: string,
): Promise<UserProfile | null> {
  const supabase = getServiceClient("SERVERONLY_getUserProfile");

  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id, role, display_name, tenants(name)")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  return {
    tenant_id: data.tenant_id,
    tenant_name:
      (data as { tenants?: { name?: string | null } | null }).tenants?.name ??
      null,
    role: data.role as UserRole,
    display_name: data.display_name,
  };
}
