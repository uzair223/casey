import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";
import type { NotificationType } from "@/types";

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

export async function SERVERONLY_createUserNotifications(input: {
  tenantId: string;
  recipientUserIds: string[];
  actorUserId?: string | null;
  notificationType: NotificationType;
  entityType: "case_note" | "statement_note" | "statement";
  entityId: string;
  title: string;
  body: string;
  linkPath: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getServiceClient("SERVERONLY_createUserNotifications");

  const recipientUserIds = Array.from(new Set(input.recipientUserIds));
  if (!recipientUserIds.length) {
    return;
  }

  const rows = recipientUserIds.map((recipientUserId) => ({
    tenant_id: input.tenantId,
    recipient_user_id: recipientUserId,
    actor_user_id: input.actorUserId ?? null,
    notification_type: input.notificationType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    title: input.title,
    body: input.body,
    link_path: input.linkPath,
    metadata: input.metadata ?? {},
  }));

  const { error } = await supabase.from("user_notifications").upsert(rows, {
    onConflict:
      "tenant_id,recipient_user_id,notification_type,entity_type,entity_id",
    ignoreDuplicates: true,
  });

  if (error) {
    throw error;
  }
}
