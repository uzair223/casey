import { AccountDeletionRequest } from "@/types";
import { getSupabaseClient } from "../client";

/**
 * Get account deletion requests for the signed-in user.
 * Client-callable: RLS ensures users only see allowed rows.
 */
export async function getOwnAccountDeletionRequests(
  userId: string,
): Promise<Pick<AccountDeletionRequest, "id" | "status" | "created_at">[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id, status, created_at")
    .eq("requested_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data as Pick<AccountDeletionRequest, "id" | "status" | "created_at">[];
}

/**
 * Get account deletion requests for a tenant.
 * Client-callable for tenant admins: RLS controls access.
 */
export async function getTenantAccountDeletionRequests(
  tenantId: string,
): Promise<AccountDeletionRequest[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select(
      "id, requested_user_id, requested_by_user_id, reason, status, reviewed_by_user_id, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return data as AccountDeletionRequest[];
}
