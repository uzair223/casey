import "server-only";

import { env } from "@/lib/env";
import { logServerEvent } from "@/lib/observability/logger";

export function witnessChatChannel(threadId: string, realtimeKey: string) {
  return `witness-chat:${threadId}:${realtimeKey}`;
}

export async function broadcastWitnessChat(
  channel: string,
  payload: Record<string, unknown>,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return;

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channel,
            event: "chat",
            payload,
            private: false,
          },
        ],
      }),
    });
    if (!response.ok) {
      await logServerEvent("warn", "witness_chat.broadcast_failed", {
        status: response.status,
      });
    }
  } catch (error) {
    await logServerEvent("warn", "witness_chat.broadcast_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
