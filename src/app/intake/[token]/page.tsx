import { redirect } from "next/navigation";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";

type MessageLike = {
  role: string;
  content: string;
  created_at?: string;
  meta?: unknown;
};

function hasPendingFollowUp(messages: MessageLike[]): boolean {
  const latestFollowUp = [...messages].reverse().find((message) => {
    const meta =
      message.meta && typeof message.meta === "object"
        ? (message.meta as Record<string, unknown>)
        : null;
    return message.role === "assistant" && meta?.followUpRequest === true;
  });

  if (!latestFollowUp) {
    return false;
  }

  const followUpTimestamp = new Date(latestFollowUp.created_at ?? 0).getTime();

  const hasResponseAfterFollowUp = messages.some((message) => {
    if (message.role !== "user") {
      return false;
    }

    if (!message.content?.trim()) {
      return false;
    }

    const responseTimestamp = new Date(message.created_at ?? 0).getTime();
    return responseTimestamp > followUpTimestamp;
  });

  return !hasResponseAfterFollowUp;
}

export default async function IntakeStepRouterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  try {
    const data = await SERVERONLY_getFullStatementFromToken(token, true);

    if (data?.messages?.length && hasPendingFollowUp(data.messages)) {
      redirect(`/intake/${token}/follow-up`);
    }
  } catch {
    // Fall through to interview route where existing invalid-link UX is shown.
  }

  redirect(`/intake/${token}/interview`);
}
