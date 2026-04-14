import { getSupabaseClient } from "../client";
import { getServiceClient } from "../server";
import type { UserNotification } from "@/types";

export type MentionNotificationSourceKind = "case" | "statement";

export type MentionNotificationDispatchContext = {
  tenantId: string;
  tenantName: string;
  noteType: "case_note" | "statement_note";
  noteId: string;
  caseId: string;
  caseTitle: string;
  statementId: string | null;
  noteBody: string;
  actorUserId: string;
  actorName: string;
  mentionedUserIds: string[];
  linkPath: string;
  noteExcerpt: string;
};

const normalizeExcerpt = (body: string) => {
  const normalized = body.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 160);
};

export async function SERVERONLY_getMentionNotificationDispatchContext(
  kind: MentionNotificationSourceKind,
  noteId: string,
): Promise<MentionNotificationDispatchContext> {
  const supabase = getServiceClient(
    "SERVERONLY_getMentionNotificationDispatchContext",
  );

  if (kind === "case") {
    const { data: note, error: noteError } = await supabase
      .from("case_notes")
      .select("id, tenant_id, case_id, body, author_user_id")
      .eq("id", noteId)
      .maybeSingle();

    if (noteError || !note) {
      throw new Error("Case note not found");
    }

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("id, title")
      .eq("id", note.case_id)
      .maybeSingle();

    if (caseError || !caseRow) {
      throw new Error("Case not found");
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", note.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      throw new Error("Tenant not found");
    }

    const { data: mentions, error: mentionsError } = await supabase
      .from("case_note_mentions")
      .select("mentioned_user_id")
      .eq("case_note_id", note.id);

    if (mentionsError) {
      throw mentionsError;
    }

    const { data: actorProfile, error: actorError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", note.author_user_id)
      .maybeSingle();

    if (actorError) {
      throw actorError;
    }

    return {
      tenantId: note.tenant_id,
      tenantName: tenant.name,
      noteType: "case_note",
      noteId: note.id,
      caseId: note.case_id,
      caseTitle: caseRow.title,
      statementId: null,
      noteBody: note.body,
      actorUserId: note.author_user_id,
      actorName: actorProfile?.display_name || "A team member",
      mentionedUserIds: Array.from(
        new Set((mentions ?? []).map((row) => row.mentioned_user_id)),
      ),
      linkPath: `/cases/${note.case_id}`,
      noteExcerpt: normalizeExcerpt(note.body),
    };
  }

  const { data: note, error: noteError } = await supabase
    .from("statement_notes")
    .select("id, tenant_id, statement_id, body, author_user_id")
    .eq("id", noteId)
    .maybeSingle();

  if (noteError || !note) {
    throw new Error("Statement note not found");
  }

  const { data: statement, error: statementError } = await supabase
    .from("statements")
    .select("id, case_id")
    .eq("id", note.statement_id)
    .maybeSingle();

  if (statementError || !statement) {
    throw new Error("Statement not found");
  }

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, title")
    .eq("id", statement.case_id)
    .maybeSingle();

  if (caseError || !caseRow) {
    throw new Error("Case not found");
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", note.tenant_id)
    .maybeSingle();

  if (tenantError || !tenant) {
    throw new Error("Tenant not found");
  }

  const { data: mentions, error: mentionsError } = await supabase
    .from("statement_note_mentions")
    .select("mentioned_user_id")
    .eq("statement_note_id", note.id);

  if (mentionsError) {
    throw mentionsError;
  }

  const { data: actorProfile, error: actorError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", note.author_user_id)
    .maybeSingle();

  if (actorError) {
    throw actorError;
  }

  return {
    tenantId: note.tenant_id,
    tenantName: tenant.name,
    noteType: "statement_note",
    noteId: note.id,
    caseId: statement.case_id,
    caseTitle: caseRow.title,
    statementId: statement.id,
    noteBody: note.body,
    actorUserId: note.author_user_id,
    actorName: actorProfile?.display_name || "A team member",
    mentionedUserIds: Array.from(
      new Set((mentions ?? []).map((row) => row.mentioned_user_id)),
    ),
    linkPath: `/cases/${statement.case_id}?statement=${statement.id}`,
    noteExcerpt: normalizeExcerpt(note.body),
  };
}

export async function getCurrentUserNotifications(
  limit = 50,
): Promise<UserNotification[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_notifications")
    .select(
      "id, tenant_id, recipient_user_id, actor_user_id, notification_type, entity_type, entity_id, title, body, link_path, metadata, read_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    ...item,
    metadata: item.metadata as Record<string, unknown>,
  })) as UserNotification[];
}

export async function getUnreadNotificationCount() {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
