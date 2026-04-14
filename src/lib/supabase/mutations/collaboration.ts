import { getSupabaseClient } from "../client";
import type { TenantNotificationPreferences, UploadedDocument } from "@/types";

function uniqueMentionIds(mentionedUserIds?: string[]) {
  return Array.from(new Set((mentionedUserIds ?? []).filter(Boolean)));
}

export async function createCaseNote(input: {
  tenantId: string;
  caseId: string;
  authorUserId: string;
  body: string;
  mentionedUserIds?: string[];
}) {
  const supabase = getSupabaseClient();

  const { data: note, error } = await supabase
    .from("case_notes")
    .insert({
      tenant_id: input.tenantId,
      case_id: input.caseId,
      author_user_id: input.authorUserId,
      body: input.body,
    })
    .select("id, tenant_id")
    .single();

  if (error) {
    throw error;
  }

  const mentions = uniqueMentionIds(input.mentionedUserIds);
  if (mentions.length) {
    const { error: mentionError } = await supabase
      .from("case_note_mentions")
      .insert(
        mentions.map((mentionedUserId) => ({
          tenant_id: note.tenant_id,
          case_note_id: note.id,
          mentioned_user_id: mentionedUserId,
          created_by_user_id: input.authorUserId,
        })),
      );

    if (mentionError) {
      throw mentionError;
    }
  }

  return note.id;
}

export async function createStatementNote(input: {
  tenantId: string;
  statementId: string;
  authorUserId: string;
  body: string;
  mentionedUserIds?: string[];
}) {
  const supabase = getSupabaseClient();

  const { data: note, error } = await supabase
    .from("statement_notes")
    .insert({
      tenant_id: input.tenantId,
      statement_id: input.statementId,
      author_user_id: input.authorUserId,
      body: input.body,
    })
    .select("id, tenant_id")
    .single();

  if (error) {
    throw error;
  }

  const mentions = uniqueMentionIds(input.mentionedUserIds);
  if (mentions.length) {
    const { error: mentionError } = await supabase
      .from("statement_note_mentions")
      .insert(
        mentions.map((mentionedUserId) => ({
          tenant_id: note.tenant_id,
          statement_note_id: note.id,
          mentioned_user_id: mentionedUserId,
          created_by_user_id: input.authorUserId,
        })),
      );

    if (mentionError) {
      throw mentionError;
    }
  }

  return note.id;
}

export async function setCaseNotePinned(input: {
  noteId: string;
  isPinned: boolean;
  pinnedByUserId: string;
}) {
  const supabase = getSupabaseClient();
  const pinnedAt = input.isPinned ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("case_notes")
    .update({
      is_pinned: input.isPinned,
      pinned_at: pinnedAt,
      pinned_by_user_id: input.isPinned ? input.pinnedByUserId : null,
    })
    .eq("id", input.noteId);

  if (error) {
    throw error;
  }
}

export async function setStatementNotePinned(input: {
  noteId: string;
  isPinned: boolean;
  pinnedByUserId: string;
}) {
  const supabase = getSupabaseClient();
  const pinnedAt = input.isPinned ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("statement_notes")
    .update({
      is_pinned: input.isPinned,
      pinned_at: pinnedAt,
      pinned_by_user_id: input.isPinned ? input.pinnedByUserId : null,
    })
    .eq("id", input.noteId);

  if (error) {
    throw error;
  }
}

export async function updateCaseNote(input: { noteId: string; body: string }) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("case_notes")
    .update({ body: input.body })
    .eq("id", input.noteId);

  if (error) {
    throw error;
  }
}

export async function deleteCaseNote(noteId: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("case_notes").delete().eq("id", noteId);

  if (error) {
    throw error;
  }
}

export async function updateStatementNote(input: {
  noteId: string;
  body: string;
}) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("statement_notes")
    .update({ body: input.body })
    .eq("id", input.noteId);

  if (error) {
    throw error;
  }
}

export async function deleteStatementNote(noteId: string) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("statement_notes")
    .delete()
    .eq("id", noteId);

  if (error) {
    throw error;
  }
}

export async function upsertTenantNotificationPreferences(input: {
  tenantId: string;
  updatedByUserId: string;
  remindersChannel?: TenantNotificationPreferences["reminders_channel"];
  followUpRequestsChannel?: TenantNotificationPreferences["follow_up_requests_channel"];
  submissionsChannel?: TenantNotificationPreferences["submissions_channel"];
  mentionChannel?: TenantNotificationPreferences["mention_channel"];
  digestFrequency?: TenantNotificationPreferences["digest_frequency"];
}) {
  const supabase = getSupabaseClient();

  const payload: Partial<TenantNotificationPreferences> & {
    tenant_id: string;
    updated_by_user_id: string;
  } = {
    tenant_id: input.tenantId,
    updated_by_user_id: input.updatedByUserId,
  };

  if (input.remindersChannel)
    payload.reminders_channel = input.remindersChannel;
  if (input.followUpRequestsChannel) {
    payload.follow_up_requests_channel = input.followUpRequestsChannel;
  }
  if (input.submissionsChannel)
    payload.submissions_channel = input.submissionsChannel;
  if (input.mentionChannel) payload.mention_channel = input.mentionChannel;
  if (input.digestFrequency) payload.digest_frequency = input.digestFrequency;

  const { data, error } = await supabase
    .from("tenant_notification_preferences")
    .upsert(payload, { onConflict: "tenant_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createCaseInternalDocument(input: {
  tenantId: string;
  caseId: string;
  uploadedByUserId: string;
  document: UploadedDocument;
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("case_documents")
    .insert({
      tenant_id: input.tenantId,
      case_id: input.caseId,
      uploaded_by_user_id: input.uploadedByUserId,
      document: input.document,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function renameCaseInternalDocument(input: {
  documentId: string;
  document: UploadedDocument;
  name: string;
}) {
  const supabase = getSupabaseClient();
  const nextName = input.name.trim();

  if (!nextName) {
    throw new Error("Document name cannot be empty");
  }

  const nextDocument: UploadedDocument = {
    ...input.document,
    name: nextName,
  };

  const { error } = await supabase
    .from("case_documents")
    .update({ document: nextDocument })
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }
}

export async function deleteCaseInternalDocument(input: {
  documentId: string;
  document: UploadedDocument;
  fallbackBucketId?: string;
}) {
  const supabase = getSupabaseClient();
  const bucketId = input.document.bucketId || input.fallbackBucketId;

  if (bucketId && input.document.path) {
    const { error: storageError } = await supabase.storage
      .from(bucketId)
      .remove([input.document.path]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase
    .from("case_documents")
    .delete()
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }
}

export async function createStatementInternalDocument(input: {
  tenantId: string;
  statementId: string;
  uploadedByUserId: string;
  document: UploadedDocument;
}) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("statement_internal_documents")
    .insert({
      tenant_id: input.tenantId,
      statement_id: input.statementId,
      uploaded_by_user_id: input.uploadedByUserId,
      document: input.document,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function renameStatementInternalDocument(input: {
  documentId: string;
  document: UploadedDocument;
  name: string;
}) {
  const supabase = getSupabaseClient();
  const nextName = input.name.trim();

  if (!nextName) {
    throw new Error("Document name cannot be empty");
  }

  const nextDocument: UploadedDocument = {
    ...input.document,
    name: nextName,
  };

  const { error } = await supabase
    .from("statement_internal_documents")
    .update({ document: nextDocument })
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }
}

export async function deleteStatementInternalDocument(input: {
  documentId: string;
  document: UploadedDocument;
  fallbackBucketId?: string;
}) {
  const supabase = getSupabaseClient();
  const bucketId = input.document.bucketId || input.fallbackBucketId;

  if (bucketId && input.document.path) {
    const { error: storageError } = await supabase.storage
      .from(bucketId)
      .remove([input.document.path]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase
    .from("statement_internal_documents")
    .delete()
    .eq("id", input.documentId);

  if (error) {
    throw error;
  }
}

export async function upsertStatementReminderRule(input: {
  tenantId: string;
  statementId: string;
  createdByUserId: string;
  isEnabled: boolean;
  cadenceDays: number;
  maxReminders?: number | null;
  nextSendAt?: string | null;
}) {
  const supabase = getSupabaseClient();

  const payload = {
    tenant_id: input.tenantId,
    statement_id: input.statementId,
    created_by_user_id: input.createdByUserId,
    is_enabled: input.isEnabled,
    cadence_days: input.cadenceDays,
    max_reminders: input.maxReminders ?? null,
    next_send_at: input.nextSendAt ?? null,
  };

  const { data, error } = await supabase
    .from("statement_reminder_rules")
    .upsert(payload, { onConflict: "statement_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
