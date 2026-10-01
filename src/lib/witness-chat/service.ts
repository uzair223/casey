import "server-only";

import { randomBytes } from "node:crypto";

import { userError } from "@/lib/api-utils";
import { logAuditEvent } from "@/lib/observability/audit";
import { logServerEvent } from "@/lib/observability/logger";
import { createStatementSupportingDocumentWithClient } from "@/lib/supabase/mutations/statement-supporting-documents";
import { getServiceClient } from "@/lib/supabase/server";
import type { Database, Json, UploadedDocument } from "@/types";
import { broadcastWitnessChat, witnessChatChannel } from "@/lib/witness-chat/broadcast";
import {
  onFirmCaughtUp,
  onFirmMessage,
  onFirmPresence,
  onWitnessMessage,
  onWitnessPresence,
  onWitnessRead,
  type ThreadNotifyState,
} from "@/lib/witness-chat/state";
import type {
  WitnessChatFileRequest,
  WitnessChatMessage,
  WitnessChatSnapshot,
  WitnessChatViewer,
} from "@/lib/witness-chat/types";

type ThreadRow = Database["public"]["Tables"]["witness_threads"]["Row"];
type MessageRow = Database["public"]["Tables"]["witness_messages"]["Row"];
type FileRequestRow =
  Database["public"]["Tables"]["witness_file_requests"]["Row"];

export type ChatStatement = {
  id: string;
  tenantId: string;
  caseId: string;
  title: string;
  witnessName: string;
  witnessEmail: string;
  contactPhone: string | null;
};

const MAX_BODY = 5000;
const MAX_LABEL = 200;

function db() {
  return getServiceClient("witness-chat");
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

function notifyPatch(
  state: ThreadNotifyState,
): Database["public"]["Tables"]["witness_threads"]["Update"] {
  return {
    witness_last_seen_at: state.witnessLastSeenAt,
    witness_last_message_at: state.witnessLastMessageAt,
    unread_firm_since: state.unreadFirmSince,
    notify_after: state.notifyAfter,
    last_outreach_at: state.lastOutreachAt,
    outreach_anchor_at: state.outreachAnchorAt,
    reminder_stage: state.reminderStage,
    next_reminder_at: state.nextReminderAt,
    firm_last_seen_at: state.firmLastSeenAt,
    firm_unread_since: state.firmUnreadSince,
    firm_notify_after: state.firmNotifyAfter,
    firm_last_notified_at: state.firmLastNotifiedAt,
  };
}

async function saveNotifyState(threadId: string, state: ThreadNotifyState) {
  const { error } = await db()
    .from("witness_threads")
    .update(notifyPatch(state))
    .eq("id", threadId);
  if (error) throw error;
}

function normalizeAttachments(value: Json): UploadedDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (typeof record.path !== "string" || typeof record.name !== "string") {
      return [];
    }
    return [
      {
        name: record.name,
        path: record.path,
        type:
          typeof record.type === "string"
            ? record.type
            : "application/octet-stream",
        bucketId:
          typeof record.bucketId === "string" ? record.bucketId : undefined,
        uploadedAt:
          typeof record.uploadedAt === "string" ? record.uploadedAt : "",
        group: typeof record.group === "string" ? record.group : undefined,
      },
    ];
  });
}

function formatDue(dueAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dueAt));
}

export async function ensureWitnessThread(statement: ChatStatement) {
  const supabase = db();
  const { data: existing, error: existingError } = await supabase
    .from("witness_threads")
    .select("*")
    .eq("statement_id", statement.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("witness_threads")
    .insert({
      statement_id: statement.id,
      tenant_id: statement.tenantId,
      realtime_key: randomBytes(24).toString("hex"),
    })
    .select("*")
    .single();

  if (!error && data) return data;
  if (error && "code" in error && error.code === "23505") {
    const { data: raced, error: racedError } = await supabase
      .from("witness_threads")
      .select("*")
      .eq("statement_id", statement.id)
      .single();
    if (racedError) throw racedError;
    return raced;
  }
  throw error;
}

async function loadSnapshot(
  statement: ChatStatement,
  thread: ThreadRow,
  viewer: WitnessChatViewer,
  viewerUserId: string | null,
): Promise<WitnessChatSnapshot> {
  const supabase = db();
  const [{ data: messages, error: messageError }, { data: reads, error: readError }, { data: requests, error: requestError }] =
    await Promise.all([
      supabase
        .from("witness_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true }),
      supabase.from("witness_reads").select("*").eq("thread_id", thread.id),
      supabase
        .from("witness_file_requests")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true }),
    ]);
  if (messageError) throw messageError;
  if (readError) throw readError;
  if (requestError) throw requestError;

  const witnessRead = (reads ?? []).find((read) => read.reader_key === "witness");
  const firmLastReadAt = (reads ?? [])
    .filter((read) => read.reader_type === "firm")
    .reduce<string | null>((latest, read) => {
      if (!latest) return read.last_read_at;
      return new Date(read.last_read_at).getTime() > new Date(latest).getTime()
        ? read.last_read_at
        : latest;
    }, null);

  return {
    threadId: thread.id,
    realtimeChannel: witnessChatChannel(thread.id, thread.realtime_key),
    caseId: statement.caseId,
    caseTitle: statement.title,
    statementId: statement.id,
    witnessName: statement.witnessName,
    messages: (messages ?? []).map(toMessage),
    fileRequests: (requests ?? []).map(toFileRequest),
    witnessLastReadAt: witnessRead?.last_read_at ?? null,
    firmLastReadAt,
    viewer,
    viewerUserId,
  };
}

function toMessage(row: MessageRow): WitnessChatMessage {
  return {
    id: row.id,
    senderType: row.sender_type === "witness" ? "witness" : "firm",
    senderUserId: row.sender_user_id,
    senderName: row.sender_name,
    body: row.body,
    attachments: normalizeAttachments(row.attachments),
    createdAt: row.created_at,
    clientId: row.client_id,
  };
}

function toFileRequest(row: FileRequestRow): WitnessChatFileRequest {
  return {
    id: row.id,
    messageId: row.message_id,
    label: row.label,
    dueAt: row.due_at,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
  };
}

export async function loadWitnessChat(
  statement: ChatStatement,
  viewer: WitnessChatViewer,
  viewerUserId: string | null,
) {
  const thread = await ensureWitnessThread(statement);
  return loadSnapshot(statement, thread, viewer, viewerUserId);
}

async function clearChatSms(threadId: string) {
  const { error } = await db()
    .from("witness_outbound_sms")
    .delete()
    .eq("thread_id", threadId)
    .eq("kind", "chat")
    .is("sent_at", null);
  if (error) throw error;
}

async function rememberSupportingDocuments(input: {
  statement: ChatStatement;
  attachments: UploadedDocument[];
  senderType: "witness" | "firm";
  senderUserId: string | null;
  senderName: string;
}) {
  if (input.attachments.length === 0) return;
  const supabase = db();
  for (const document of input.attachments) {
    try {
      await createStatementSupportingDocumentWithClient(supabase, {
        tenantId: input.statement.tenantId,
        caseId: input.statement.caseId,
        statementId: input.statement.id,
        uploadedByType:
          input.senderType === "witness" ? "witness" : "internal_user",
        uploadedByUserId: input.senderUserId,
        uploadedByWitnessName:
          input.senderType === "witness" ? input.senderName : null,
        uploadedByWitnessEmail:
          input.senderType === "witness" ? input.statement.witnessEmail : null,
        document,
      });
    } catch (error) {
      await logServerEvent("warn", "witness_chat.supporting_document_skipped", {
        statementId: input.statement.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

function assertPost(input: {
  body: string;
  attachments: UploadedDocument[];
  fileRequest: { label: string; dueAt: string | null } | null;
  allowFileRequest: boolean;
}) {
  if (input.body.length > MAX_BODY) {
    throw userError(`Message must be ${MAX_BODY} characters or less`);
  }
  if (input.fileRequest && !input.allowFileRequest) {
    throw userError("Only the firm can request a file");
  }
  if (input.fileRequest && input.fileRequest.label.length > MAX_LABEL) {
    throw userError(`File request must be ${MAX_LABEL} characters or less`);
  }
  if (input.fileRequest?.dueAt) {
    const due = new Date(input.fileRequest.dueAt);
    if (Number.isNaN(due.getTime())) {
      throw userError("File deadline is not a valid date");
    }
    if (due.getTime() < Date.now() - 60_000) {
      throw userError("File deadline must be in the future");
    }
  }
  if (!input.body && input.attachments.length === 0 && !input.fileRequest) {
    throw userError("Message is required");
  }
}

function messageBody(
  body: string,
  fileRequest: { label: string; dueAt: string | null } | null,
) {
  if (body) return body;
  if (!fileRequest) return "";
  if (fileRequest.dueAt) {
    return `Please send ${fileRequest.label} by ${formatDue(fileRequest.dueAt)}.`;
  }
  return `Please send ${fileRequest.label}.`;
}

async function insertMessage(input: {
  statement: ChatStatement;
  thread: ThreadRow;
  senderType: "witness" | "firm";
  senderUserId: string | null;
  senderName: string;
  body: string;
  clientId: string | null;
  attachments: UploadedDocument[];
  fileRequest: { label: string; dueAt: string | null } | null;
  fileRequestId: string | null;
}) {
  assertPost({
    body: input.body,
    attachments: input.attachments,
    fileRequest: input.fileRequest,
    allowFileRequest: input.senderType === "firm",
  });

  const supabase = db();
  if (input.clientId) {
    const { data: existing, error } = await supabase
      .from("witness_messages")
      .select("id")
      .eq("thread_id", input.thread.id)
      .eq("client_id", input.clientId)
      .maybeSingle();
    if (error) throw error;
    if (existing) return existing.id;
  }

  if (input.fileRequestId) {
    if (input.attachments.length === 0) {
      throw userError("Upload a file to complete this request");
    }
    const { data: openRequest, error } = await supabase
      .from("witness_file_requests")
      .select("id")
      .eq("id", input.fileRequestId)
      .eq("thread_id", input.thread.id)
      .is("fulfilled_at", null)
      .is("cancelled_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!openRequest) {
      throw userError("That file request is no longer open");
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const { data: message, error: insertError } = await supabase
    .from("witness_messages")
    .insert({
      thread_id: input.thread.id,
      statement_id: input.statement.id,
      tenant_id: input.statement.tenantId,
      sender_type: input.senderType,
      sender_user_id: input.senderUserId,
      sender_name: input.senderName,
      body: messageBody(input.body, input.fileRequest),
      attachments: input.attachments as unknown as Json,
      client_id: input.clientId,
      created_at: nowIso,
    })
    .select("id")
    .single();
  if (insertError || !message) throw insertError ?? new Error("Message was not saved");

  if (input.fileRequest) {
    const { error } = await supabase.from("witness_file_requests").insert({
      thread_id: input.thread.id,
      message_id: message.id,
      tenant_id: input.statement.tenantId,
      statement_id: input.statement.id,
      label: input.fileRequest.label,
      due_at: input.fileRequest.dueAt,
      created_by: input.senderUserId,
    });
    if (error) throw error;
  }

  if (input.fileRequestId) {
    const { error } = await supabase
      .from("witness_file_requests")
      .update({ fulfilled_at: nowIso })
      .eq("id", input.fileRequestId)
      .eq("thread_id", input.thread.id);
    if (error) throw error;
  }

  const nextState =
    input.senderType === "firm"
      ? onFirmMessage(toNotifyState(input.thread), now.getTime(), nowIso)
      : onWitnessMessage(toNotifyState(input.thread), now.getTime(), nowIso);
  await saveNotifyState(input.thread.id, nextState);
  if (input.senderType === "witness") {
    await clearChatSms(input.thread.id);
  }

  await rememberSupportingDocuments({
    statement: input.statement,
    attachments: input.attachments,
    senderType: input.senderType,
    senderUserId: input.senderUserId,
    senderName: input.senderName,
  });

  await broadcastWitnessChat(
    witnessChatChannel(input.thread.id, input.thread.realtime_key),
    { type: "message", id: message.id },
  );

  await logAuditEvent({
    tenantId: input.statement.tenantId,
    actorUserId: input.senderUserId,
    action:
      input.senderType === "firm"
        ? "statement.witness_chat.firm_message"
        : "statement.witness_chat.witness_message",
    targetType: "witness_messages",
    targetId: message.id,
    metadata: { statementId: input.statement.id },
  });

  return message.id;
}

export async function postWitnessChatMessage(input: {
  statement: ChatStatement;
  body: string;
  clientId: string | null;
  attachments: UploadedDocument[];
  fileRequestId: string | null;
}) {
  const thread = await ensureWitnessThread(input.statement);
  await insertMessage({
    statement: input.statement,
    thread,
    senderType: "witness",
    senderUserId: null,
    senderName: input.statement.witnessName || "Witness",
    body: input.body,
    clientId: input.clientId,
    attachments: input.attachments,
    fileRequest: null,
    fileRequestId: input.fileRequestId,
  });
  return loadWitnessChat(input.statement, "witness", null);
}

export async function postFirmChatMessage(input: {
  statement: ChatStatement;
  userId: string;
  senderName: string;
  body: string;
  clientId: string | null;
  attachments: UploadedDocument[];
  fileRequest: { label: string; dueAt: string | null } | null;
}) {
  const thread = await ensureWitnessThread(input.statement);
  await insertMessage({
    statement: input.statement,
    thread,
    senderType: "firm",
    senderUserId: input.userId,
    senderName: input.senderName || "Legal team",
    body: input.body,
    clientId: input.clientId,
    attachments: input.attachments,
    fileRequest: input.fileRequest,
    fileRequestId: null,
  });
  return loadWitnessChat(input.statement, "firm", input.userId);
}

async function upsertRead(input: {
  threadId: string;
  readerKey: string;
  readerType: "witness" | "firm";
  readerUserId: string | null;
  lastReadAt: string;
}) {
  const { error } = await db().from("witness_reads").upsert(
    {
      thread_id: input.threadId,
      reader_key: input.readerKey,
      reader_type: input.readerType,
      reader_user_id: input.readerUserId,
      last_read_at: input.lastReadAt,
    },
    { onConflict: "thread_id,reader_key" },
  );
  if (error) throw error;
}

export async function markWitnessRead(statement: ChatStatement) {
  const thread = await ensureWitnessThread(statement);
  const nowIso = new Date().toISOString();
  await upsertRead({
    threadId: thread.id,
    readerKey: "witness",
    readerType: "witness",
    readerUserId: null,
    lastReadAt: nowIso,
  });
  await saveNotifyState(thread.id, onWitnessRead(toNotifyState(thread), nowIso));
  await clearChatSms(thread.id);
  await broadcastWitnessChat(
    witnessChatChannel(thread.id, thread.realtime_key),
    { type: "read", id: thread.id },
  );
  return { ok: true as const };
}

export async function markFirmRead(statement: ChatStatement, userId: string) {
  const thread = await ensureWitnessThread(statement);
  const nowIso = new Date().toISOString();
  await upsertRead({
    threadId: thread.id,
    readerKey: userId,
    readerType: "firm",
    readerUserId: userId,
    lastReadAt: nowIso,
  });
  const { data: latestWitness, error } = await db()
    .from("witness_messages")
    .select("created_at")
    .eq("thread_id", thread.id)
    .eq("sender_type", "witness")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const caughtUp =
    !latestWitness ||
    new Date(nowIso).getTime() >= new Date(latestWitness.created_at).getTime();
  if (caughtUp) {
    await saveNotifyState(thread.id, onFirmCaughtUp(toNotifyState(thread)));
  }
  await broadcastWitnessChat(
    witnessChatChannel(thread.id, thread.realtime_key),
    { type: "read", id: thread.id },
  );
  return { ok: true as const };
}

export async function touchWitnessPresence(statement: ChatStatement) {
  const thread = await ensureWitnessThread(statement);
  const nowIso = new Date().toISOString();
  await saveNotifyState(
    thread.id,
    onWitnessPresence(toNotifyState(thread), nowIso),
  );
  return { ok: true as const };
}

export async function touchFirmPresence(statement: ChatStatement) {
  const thread = await ensureWitnessThread(statement);
  const nowIso = new Date().toISOString();
  await saveNotifyState(thread.id, onFirmPresence(toNotifyState(thread), nowIso));
  return { ok: true as const };
}

export async function cancelFileRequest(input: {
  statement: ChatStatement;
  requestId: string;
  userId: string;
}) {
  const thread = await ensureWitnessThread(input.statement);
  const nowIso = new Date().toISOString();
  const { data, error } = await db()
    .from("witness_file_requests")
    .update({ cancelled_at: nowIso })
    .eq("id", input.requestId)
    .eq("thread_id", thread.id)
    .is("fulfilled_at", null)
    .is("cancelled_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw userError("That file request is no longer open");
  await broadcastWitnessChat(
    witnessChatChannel(thread.id, thread.realtime_key),
    { type: "message", id: input.requestId },
  );
  await logAuditEvent({
    tenantId: input.statement.tenantId,
    actorUserId: input.userId,
    action: "statement.witness_chat.file_request_cancelled",
    targetType: "witness_file_requests",
    targetId: input.requestId,
    metadata: { statementId: input.statement.id },
  });
  return loadWitnessChat(input.statement, "firm", input.userId);
}

export async function statementHasUnreadFirmChat(statementId: string) {
  const supabase = db();
  const { data: thread, error } = await supabase
    .from("witness_threads")
    .select("id")
    .eq("statement_id", statementId)
    .maybeSingle();
  if (error) throw error;
  if (!thread) return null;

  const { data: latest, error: latestError } = await supabase
    .from("witness_messages")
    .select("created_at")
    .eq("thread_id", thread.id)
    .eq("sender_type", "firm")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  if (!latest) return false;

  const { data: read, error: readError } = await supabase
    .from("witness_reads")
    .select("last_read_at")
    .eq("thread_id", thread.id)
    .eq("reader_key", "witness")
    .maybeSingle();
  if (readError) throw readError;
  if (!read) return true;
  return new Date(read.last_read_at).getTime() < new Date(latest.created_at).getTime();
}

export async function getFirmChatStatement(
  statementId: string,
  tenantId: string,
): Promise<ChatStatement | null> {
  const { data, error } = await db()
    .from("statements")
    .select(
      "id, tenant_id, case_id, title, witness_name, witness_email, contact_phone",
    )
    .eq("id", statementId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    tenantId: data.tenant_id,
    caseId: data.case_id,
    title: data.title,
    witnessName: data.witness_name,
    witnessEmail: data.witness_email,
    contactPhone: data.contact_phone,
  };
}
