import { NextRequest } from "next/server";

import { badRequest, ok, serverError } from "@/lib/api-utils/response";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { sendMentionNotificationEmail } from "@/lib/email";
import {
  SERVERONLY_getMentionNotificationDispatchContext,
  type MentionNotificationSourceKind,
} from "@/lib/supabase/queries";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTenantUser(request);
    const body = await request.json().catch(() => ({}));
    const kind =
      body?.kind === "statement"
        ? ("statement" as MentionNotificationSourceKind)
        : body?.kind === "case"
          ? ("case" as MentionNotificationSourceKind)
          : null;
    const noteId = typeof body?.noteId === "string" ? body.noteId.trim() : "";

    if (!kind || !noteId) {
      return badRequest("kind and noteId are required");
    }

    const context = await SERVERONLY_getMentionNotificationDispatchContext(
      kind,
      noteId,
    );

    if (context.tenantId !== auth.tenantId) {
      return badRequest("Note not found");
    }

    const supabase = getServiceClient("mention_notifications");
    const { data: preferences, error: preferenceError } = await supabase
      .from("tenant_notification_preferences")
      .select("mention_channel")
      .eq("tenant_id", auth.tenantId)
      .maybeSingle();

    if (preferenceError) {
      throw preferenceError;
    }

    const mentionChannel = preferences?.mention_channel ?? "in_app";
    if (mentionChannel === "off" || mentionChannel === "in_app") {
      return ok({ ok: true, sent: 0 });
    }

    const emails = await Promise.all(
      context.mentionedUserIds.map(async (userId) => {
        const { data } = await supabase.auth.admin.getUserById(userId);
        return data.user?.email?.toLowerCase() ?? null;
      }),
    );

    const recipientEmails = Array.from(
      new Set(emails.filter((email): email is string => !!email)),
    );

    await Promise.all(
      recipientEmails.map((email) =>
        sendMentionNotificationEmail({
          to: email,
          tenantName: context.tenantName,
          actorName: context.actorName,
          caseTitle: context.caseTitle,
          noteType: context.noteType,
          noteExcerpt: context.noteExcerpt,
          url: context.linkPath,
        }),
      ),
    );

    return ok({ ok: true, sent: recipientEmails.length });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return serverError(error);
  }
}
