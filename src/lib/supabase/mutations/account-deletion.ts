import { getSupabaseClient } from "../client";

export async function createOwnAccountDeletionRequest(
  userId: string,
  tenantId: string | null,
  reason: string | null,
): Promise<{ ok: true; alreadyPending: boolean; id: string }> {
  const supabase = getSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("account_deletion_requests")
    .select("id")
    .eq("requested_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return {
      ok: true,
      alreadyPending: true,
      id: existing.id,
    };
  }

  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({
      tenant_id: tenantId,
      requested_user_id: userId,
      requested_by_user_id: userId,
      reason,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return {
    ok: true,
    alreadyPending: false,
    id: data.id,
  };
}
