import { getSupabaseClient } from "../client";

export async function markNotificationRead(notificationId: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}

export async function markAllNotificationsRead() {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) {
    throw error;
  }
}
