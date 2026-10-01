import "server-only";

import { env } from "@/lib/env";
import {
  sendWitnessChatFirmNoticeEmail,
  sendWitnessChatNoticeEmail,
  sendWitnessFileDeadlineEmail,
} from "@/lib/email";
import { logServerEvent } from "@/lib/observability/logger";
import { sendSms, smsConfigured } from "@/lib/sms/send";
import { getServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/types";
import { smsReadyAt } from "@/lib/witness-chat/quiet-hours";
import {
  DEADLINE_DEDUPE_MS,
  DEADLINE_SKIP_WINDOW_MS,
  REMINDER_24H_MS,
  REMINDER_72H_MS,
  armFirmNotify,
  armWitnessNotify,
  burstAlreadySent,
  excerpt,
  firmIsPresent,
  witnessIsEngaged,
  type ThreadNotifyState,
} from "@/lib/witness-chat/state";

type ThreadRow = Database["public"]["Tables"]["witness_threads"]["Row"];
type FileRequestRow =
  Database["public"]["Tables"]["witness_file_requests"]["Row"];

const BATCH = 50;
const HOUR_MS = 60 * 60 * 1000;

function db() {
  return getServiceClient("witness-chat-dispatch");
}

function baseUrl() {
  return env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

function toNotifyState(row: ThreadRow): ThreadNotifyState {
  return {
    witnessLastSeenAt: row.witness_last_seen_at,
    witnessLastMessageAt: row.witness_last_message_at,
    unreadFirmSince: row.unread_firm_since,
    notifyAfter: row.notify_after,
    lastOutreachAt: row.last_outreach_at,
    outreachAnchorAt: row.outreach_anchor_at,
    reminderStage: row.reminder_stage,
    nextReminderAt: row.next_reminder_at,
    firmLastSeenAt: row.firm_last_seen_at,
    firmUnreadSince: row.firm_unread_since,
    firmNotifyAfter: row.firm_notify_after,
    firmLastNotifiedAt: row.firm_last_notified_at,
  };
}

async function armDueThreads(now: Date) {
  const supabase = db();
  const nowMs = now.getTime();
  const { data: witnessThreads, error: witnessError } = await supabase
    .from("witness_threads")
    .select("*")
    .not("unread_firm_since", "is", null)
    .is("notify_after", null)
    .limit(BATCH);
  if (witnessError) throw witnessError;

  for (const thread of witnessThreads ?? []) {
    const next = armWitnessNotify(toNotifyState(thread), nowMs);
    if (!next.notifyAfter || next.notifyAfter === thread.notify_after) continue;
    await supabase
      .from("witness_threads")
      .update({ notify_after: next.notifyAfter })
      .eq("id", thread.id)
      .is("notify_after", null);
  }

  const { data: firmThreads, error: firmError } = await supabase
    .from("witness_threads")
    .select("*")
    .not("firm_unread_since", "is", null)
    .is("firm_notify_after", null)
    .limit(BATCH);
  if (firmError) throw firmError;

  for (const thread of firmThreads ?? []) {
    const next = armFirmNotify(toNotifyState(thread), nowMs);
    if (!next.firmNotifyAfter || next.firmNotifyAfter === thread.firm_notify_after) {
      continue;
    }
    await supabase
      .from("witness_threads")
      .update({ firm_notify_after: next.firmNotifyAfter })
      .eq("id", thread.id)
      .is("firm_notify_after", null);
  }
}

async function loadMailContext(thread: ThreadRow) {
  const supabase = db();
  const { data: statement, error } = await supabase
    .from("statements")
    .select(
      "id, case_id, title, witness_name, witness_email, contact_phone, tenant_id",
    )
    .eq("id", thread.statement_id)
    .maybeSingle();
  if (error) throw error;
  if (!statement) return null;

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", statement.tenant_id)
    .maybeSingle();
  if (tenantError) throw tenantError;

  const { data: link, error: linkError } = await supabase
    .from("magic_links")
    .select("token, expires_at")
    .eq("statement_id", statement.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (linkError) throw linkError;

  const { data: latestFirm, error: firmError } = await supabase
    .from("witness_messages")
    .select("id, body")
    .eq("thread_id", thread.id)
    .eq("sender_type", "firm")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (firmError) throw firmError;

  const { data: latestWitness, error: witnessError } = await supabase
    .from("witness_messages")
    .select("id, body")
    .eq("thread_id", thread.id)
    .eq("sender_type", "witness")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (witnessError) throw witnessError;

  return {
    statement,
    tenantName: tenant?.name || "Your legal team",
    token: link?.token ?? null,
    latestFirm,
    latestWitness,
    witnessUrl: link?.token
      ? `${baseUrl()}/intake/${link.token}/follow-up`
      : null,
    firmUrl: `${baseUrl()}/cases/${statement.case_id}`,
  };
}

async function deliverSms(input: {
  threadId: string;
  kind: "chat" | "deadline";
  phone: string | null;
  body: string;
  now: Date;
}) {
  if (!input.phone || !smsConfigured()) return;
  const ready = smsReadyAt(input.now);
  if (ready.getTime() <= input.now.getTime() + 1000) {
    try {
      await sendSms(input.phone, input.body);
    } catch (error) {
      await logServerEvent("warn", "witness_chat.sms_failed", {
        threadId: input.threadId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    return;
  }

  const { error } = await db().from("witness_outbound_sms").insert({
    thread_id: input.threadId,
    kind: input.kind,
    to_phone: input.phone,
    body: input.body,
    send_after: ready.toISOString(),
  });
  if (error) throw error;
}

async function flushSms(now: Date) {
  const supabase = db();
  const nowIso = now.toISOString();
  const { data, error } = await supabase
    .from("witness_outbound_sms")
    .select("*")
    .is("sent_at", null)
    .lte("send_after", nowIso)
    .limit(BATCH);
  if (error) throw error;

  for (const row of data ?? []) {
    const { data: claimed, error: claimError } = await supabase
      .from("witness_outbound_sms")
      .update({ sent_at: nowIso })
      .eq("id", row.id)
      .is("sent_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;
    try {
      const result = await sendSms(row.to_phone, row.body);
      if (!result.sent) {
        await logServerEvent("info", "witness_chat.sms_skipped", {
          threadId: row.thread_id,
          reason: result.reason,
        });
      }
    } catch (error) {
      await supabase
        .from("witness_outbound_sms")
        .update({ sent_at: null })
        .eq("id", row.id);
      await logServerEvent("warn", "witness_chat.sms_failed", {
        threadId: row.thread_id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

async function deliverWitnessNotice(
  thread: ThreadRow,
  now: Date,
  kind: "message" | "reminder",
) {
  const context = await loadMailContext(thread);
  if (!context?.witnessUrl || !context.statement.witness_email) {
    return false;
  }

  const preview = excerpt(context.latestFirm?.body ?? "");
  await sendWitnessChatNoticeEmail({
    to: context.statement.witness_email,
    tenantName: context.tenantName,
    caseTitle: context.statement.title,
    witnessName: context.statement.witness_name,
    url: context.witnessUrl,
    excerpt: preview,
    kind,
  });
  await deliverSms({
    threadId: thread.id,
    kind: "chat",
    phone: context.statement.contact_phone,
    body: `${context.tenantName} sent you a message about ${context.statement.title}. ${context.witnessUrl}`,
    now,
  });

  await db()
    .from("witness_threads")
    .update({
      last_outreach_at: now.toISOString(),
      last_outreach_message_id: context.latestFirm?.id ?? null,
      outreach_anchor_at: thread.outreach_anchor_at ?? now.toISOString(),
    })
    .eq("id", thread.id);
  return true;
}

async function dispatchInitial(now: Date) {
  const supabase = db();
  const { data, error } = await supabase
    .from("witness_threads")
    .select("*")
    .not("notify_after", "is", null)
    .lte("notify_after", now.toISOString())
    .limit(BATCH);
  if (error) throw error;

  for (const thread of data ?? []) {
    const notifyAfter = thread.notify_after;
    if (!notifyAfter) continue;
    const state = toNotifyState(thread);
    if (
      !state.unreadFirmSince ||
      witnessIsEngaged(state, now.getTime()) ||
      burstAlreadySent(state.unreadFirmSince, state.lastOutreachAt)
    ) {
      await supabase
        .from("witness_threads")
        .update({ notify_after: null })
        .eq("id", thread.id)
        .eq("notify_after", notifyAfter);
      continue;
    }

    const { data: claimed, error: claimError } = await supabase
      .from("witness_threads")
      .update({ notify_after: null })
      .eq("id", thread.id)
      .eq("notify_after", notifyAfter)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      const sent = await deliverWitnessNotice(thread, now, "message");
      if (!sent) {
        await supabase
          .from("witness_threads")
          .update({
            notify_after: new Date(now.getTime() + HOUR_MS).toISOString(),
          })
          .eq("id", thread.id);
        continue;
      }
      const anchor = thread.outreach_anchor_at ?? now.toISOString();
      await supabase
        .from("witness_threads")
        .update({
          outreach_anchor_at: anchor,
          reminder_stage: 0,
          next_reminder_at: new Date(
            new Date(anchor).getTime() + REMINDER_24H_MS,
          ).toISOString(),
        })
        .eq("id", thread.id);
    } catch (error) {
      await supabase
        .from("witness_threads")
        .update({
          notify_after: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", thread.id);
      await logServerEvent("error", "witness_chat.outreach_failed", {
        threadId: thread.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

async function dispatchFirm(now: Date) {
  const supabase = db();
  const { data, error } = await supabase
    .from("witness_threads")
    .select("*")
    .not("firm_notify_after", "is", null)
    .lte("firm_notify_after", now.toISOString())
    .limit(BATCH);
  if (error) throw error;

  for (const thread of data ?? []) {
    const firmNotifyAfter = thread.firm_notify_after;
    if (!firmNotifyAfter) continue;
    const state = toNotifyState(thread);
    if (
      !state.firmUnreadSince ||
      firmIsPresent(state, now.getTime()) ||
      burstAlreadySent(state.firmUnreadSince, state.firmLastNotifiedAt)
    ) {
      await supabase
        .from("witness_threads")
        .update({ firm_notify_after: null })
        .eq("id", thread.id)
        .eq("firm_notify_after", firmNotifyAfter);
      continue;
    }

    const { data: claimed, error: claimError } = await supabase
      .from("witness_threads")
      .update({ firm_notify_after: null })
      .eq("id", thread.id)
      .eq("firm_notify_after", firmNotifyAfter)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      const context = await loadMailContext(thread);
      if (!context) continue;
      const { data: speakers, error: speakerError } = await supabase
        .from("witness_messages")
        .select("sender_user_id")
        .eq("thread_id", thread.id)
        .eq("sender_type", "firm");
      if (speakerError) throw speakerError;
      const senderIds = [
        ...new Set(
          (speakers ?? [])
            .map((speaker) => speaker.sender_user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const preview = excerpt(context.latestWitness?.body ?? "");
      for (const userId of senderIds) {
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(userId);
        if (userError || !userData.user?.email) continue;
        await sendWitnessChatFirmNoticeEmail({
          to: userData.user.email,
          tenantName: context.tenantName,
          caseTitle: context.statement.title,
          witnessName: context.statement.witness_name,
          url: context.firmUrl,
          excerpt: preview,
        });
      }
      await supabase
        .from("witness_threads")
        .update({ firm_last_notified_at: now.toISOString() })
        .eq("id", thread.id);
    } catch (error) {
      await supabase
        .from("witness_threads")
        .update({
          firm_notify_after: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        })
        .eq("id", thread.id);
      await logServerEvent("error", "witness_chat.firm_outreach_failed", {
        threadId: thread.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

async function dispatchReminders(now: Date) {
  const supabase = db();
  const { data, error } = await supabase
    .from("witness_threads")
    .select("*")
    .not("next_reminder_at", "is", null)
    .lte("next_reminder_at", now.toISOString())
    .lt("reminder_stage", 2)
    .limit(BATCH);
  if (error) throw error;

  for (const thread of data ?? []) {
    const state = toNotifyState(thread);
    if (!state.unreadFirmSince || !state.outreachAnchorAt) {
      await supabase
        .from("witness_threads")
        .update({ next_reminder_at: null, reminder_stage: 0 })
        .eq("id", thread.id);
      continue;
    }
    const nextReminderAt = thread.next_reminder_at;
    if (!nextReminderAt) continue;
    if (witnessIsEngaged(state, now.getTime())) {
      await supabase
        .from("witness_threads")
        .update({
          next_reminder_at: new Date(now.getTime() + HOUR_MS).toISOString(),
        })
        .eq("id", thread.id)
        .eq("next_reminder_at", nextReminderAt);
      continue;
    }

    const anchor = new Date(state.outreachAnchorAt).getTime();
    const finalDue = now.getTime() >= anchor + REMINDER_72H_MS;
    const firstDue = now.getTime() >= anchor + REMINDER_24H_MS;
    if (!firstDue && !finalDue) {
      await supabase
        .from("witness_threads")
        .update({
          next_reminder_at: new Date(
            anchor + (state.reminderStage >= 1 ? REMINDER_72H_MS : REMINDER_24H_MS),
          ).toISOString(),
        })
        .eq("id", thread.id)
        .eq("next_reminder_at", nextReminderAt);
      continue;
    }

    const { data: claimed, error: claimError } = await supabase
      .from("witness_threads")
      .update({ next_reminder_at: null })
      .eq("id", thread.id)
      .eq("next_reminder_at", nextReminderAt)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    try {
      const sent = await deliverWitnessNotice(
        { ...thread, outreach_anchor_at: state.outreachAnchorAt },
        now,
        "reminder",
      );
      if (!sent) {
        await supabase
          .from("witness_threads")
          .update({
            next_reminder_at: new Date(now.getTime() + HOUR_MS).toISOString(),
          })
          .eq("id", thread.id);
        continue;
      }
      const stage = finalDue || state.reminderStage >= 1 ? 2 : 1;
      await supabase
        .from("witness_threads")
        .update({
          reminder_stage: stage,
          next_reminder_at:
            stage === 1
              ? new Date(anchor + REMINDER_72H_MS).toISOString()
              : null,
          outreach_anchor_at: state.outreachAnchorAt,
        })
        .eq("id", thread.id);
    } catch (error) {
      await supabase
        .from("witness_threads")
        .update({
          next_reminder_at: new Date(now.getTime() + HOUR_MS).toISOString(),
        })
        .eq("id", thread.id);
      await logServerEvent("error", "witness_chat.reminder_failed", {
        threadId: thread.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

function recentChatNotice(lastOutreachAt: string | null, now: Date) {
  if (!lastOutreachAt) return false;
  return now.getTime() - new Date(lastOutreachAt).getTime() < DEADLINE_DEDUPE_MS;
}

async function markRequest(
  id: string,
  patch: Database["public"]["Tables"]["witness_file_requests"]["Update"],
) {
  const { error } = await db()
    .from("witness_file_requests")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

async function sendDeadline(
  request: FileRequestRow,
  thread: ThreadRow,
  now: Date,
  kind: "upcoming" | "due" | "overdue",
) {
  const stamp =
    kind === "upcoming"
      ? "reminder_24h_sent_at"
      : kind === "due"
        ? "due_sent_at"
        : "overdue_sent_at";
  const nowIso = now.toISOString();
  if (kind !== "overdue" && recentChatNotice(thread.last_outreach_at, now)) {
    await markRequest(request.id, { [stamp]: nowIso });
    return;
  }

  const context = await loadMailContext(thread);
  if (!context?.witnessUrl || !request.due_at) {
    await markRequest(request.id, { [stamp]: nowIso });
    return;
  }

  await sendWitnessFileDeadlineEmail({
    to: context.statement.witness_email,
    tenantName: context.tenantName,
    caseTitle: context.statement.title,
    witnessName: context.statement.witness_name,
    url: context.witnessUrl,
    label: request.label,
    dueAt: request.due_at,
    kind,
  });
  await deliverSms({
    threadId: thread.id,
    kind: "deadline",
    phone: context.statement.contact_phone,
    body: `${context.tenantName}: Please send ${request.label} for ${context.statement.title}. ${context.witnessUrl}`,
    now,
  });
  await markRequest(request.id, { [stamp]: nowIso });
}

async function dispatchDeadlines(now: Date) {
  const supabase = db();
  const { data, error } = await supabase
    .from("witness_file_requests")
    .select("*")
    .is("fulfilled_at", null)
    .is("cancelled_at", null)
    .not("due_at", "is", null)
    .or(
      "reminder_24h_sent_at.is.null,due_sent_at.is.null,overdue_sent_at.is.null",
    )
    .limit(BATCH);
  if (error) throw error;

  const threadIds = [...new Set((data ?? []).map((request) => request.thread_id))];
  if (threadIds.length === 0) return;
  const { data: threads, error: threadError } = await supabase
    .from("witness_threads")
    .select("*")
    .in("id", threadIds);
  if (threadError) throw threadError;
  const threadById = new Map((threads ?? []).map((thread) => [thread.id, thread]));

  for (const request of data ?? []) {
    const thread = threadById.get(request.thread_id);
    if (!thread || !request.due_at) continue;
    const due = new Date(request.due_at).getTime();
    const created = new Date(request.created_at).getTime();
    const nowMs = now.getTime();

    if (!request.overdue_sent_at && nowMs >= due + REMINDER_24H_MS) {
      await sendDeadline(request, thread, now, "overdue");
      await markRequest(request.id, {
        reminder_24h_sent_at: request.reminder_24h_sent_at ?? now.toISOString(),
        due_sent_at: request.due_sent_at ?? now.toISOString(),
      });
      continue;
    }

    if (!request.due_sent_at && nowMs >= due) {
      await sendDeadline(request, thread, now, "due");
      if (!request.reminder_24h_sent_at) {
        await markRequest(request.id, {
          reminder_24h_sent_at: now.toISOString(),
        });
      }
      continue;
    }

    if (!request.reminder_24h_sent_at) {
      if (due - created < DEADLINE_SKIP_WINDOW_MS) {
        await markRequest(request.id, {
          reminder_24h_sent_at: now.toISOString(),
        });
      } else if (nowMs >= due - REMINDER_24H_MS) {
        await sendDeadline(request, thread, now, "upcoming");
      }
    }
  }
}

export async function runWitnessChatOutreach(now = new Date()) {
  await armDueThreads(now);
  await dispatchInitial(now);
  await dispatchFirm(now);
  await flushSms(now);
}

export async function runWitnessChatReminders(now = new Date()) {
  await dispatchReminders(now);
  await dispatchDeadlines(now);
  await flushSms(now);
}
