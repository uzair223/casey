import { getSupabaseClient } from "../client";

export async function updateCurrentUserProfile(
  user_id: string,
  displayName: string,
): Promise<{ displayName: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName.trim() })
    .eq("user_id", user_id)
    .select("display_name")
    .single();

  if (error) {
    throw error;
  }

  return { displayName: (data.display_name ?? displayName).trim() };
}
