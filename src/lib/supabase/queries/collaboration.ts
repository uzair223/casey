import { getSupabaseClient } from "../client";
import type {
  CollaborationNoteView,
  OutstandingWorkSummary,
  TenantNotificationPreferences,
  UploadedDocument,
  UnifiedTimelineEvent,
} from "@/types";

const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  TenantNotificationPreferences,
  "tenant_id" | "created_at" | "updated_at"
> = {
  reminders_channel: "email",
  follow_up_requests_channel: "email",
  submissions_channel: "email",
  mention_channel: "in_app",
  digest_frequency: "daily",
  updated_by_user_id: null,
};

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function toMentionsMap<T extends { [key: string]: string }>(
  rows: T[] | null,
  key: keyof T,
  value: keyof T,
) {
  const map = new Map<string, string[]>();

  for (const row of rows ?? []) {
    const ownerId = String(row[key]);
    const mentionUserId = String(row[value]);
    const existing = map.get(ownerId) ?? [];
    existing.push(mentionUserId);
    map.set(ownerId, existing);
  }

  return map;
}

export async function getCaseNotes(
  caseId: string,
): Promise<CollaborationNoteView[]> {
  const supabase = getSupabaseClient();

  const { data: notes, error } = await supabase
    .from("case_notes")
    .select(
      "id, body, created_at, updated_at, author_user_id, is_pinned, pinned_at, pinned_by_user_id",
    )
    .eq("case_id", caseId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const noteIds = uniqueIds((notes ?? []).map((note) => note.id));
  if (!noteIds.length) {
    return [];
  }

  const { data: mentions, error: mentionsError } = await supabase
    .from("case_note_mentions")
    .select("case_note_id, mentioned_user_id")
    .in("case_note_id", noteIds);

  if (mentionsError) {
    throw mentionsError;
  }

  const mentionsMap = toMentionsMap(
    mentions,
    "case_note_id",
    "mentioned_user_id",
  );

  return (notes ?? []).map((note) => ({
    ...note,
    mentions: mentionsMap.get(note.id) ?? [],
  }));
}

export async function getStatementNotes(
  statementId: string,
): Promise<CollaborationNoteView[]> {
  const supabase = getSupabaseClient();

  const { data: notes, error } = await supabase
    .from("statement_notes")
    .select(
      "id, body, created_at, updated_at, author_user_id, is_pinned, pinned_at, pinned_by_user_id",
    )
    .eq("statement_id", statementId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const noteIds = uniqueIds((notes ?? []).map((note) => note.id));
  if (!noteIds.length) {
    return [];
  }

  const { data: mentions, error: mentionsError } = await supabase
    .from("statement_note_mentions")
    .select("statement_note_id, mentioned_user_id")
    .in("statement_note_id", noteIds);

  if (mentionsError) {
    throw mentionsError;
  }

  const mentionsMap = toMentionsMap(
    mentions,
    "statement_note_id",
    "mentioned_user_id",
  );

  return (notes ?? []).map((note) => ({
    ...note,
    mentions: mentionsMap.get(note.id) ?? [],
  }));
}

export async function getTenantNotificationPreferences(tenantId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tenant_notification_preferences")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      tenant_id: tenantId,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  return data;
}

export async function getCaseInternalDocuments(caseId: string): Promise<
  Array<{
    id: string;
    created_at: string;
    uploaded_by_user_id: string;
    document: UploadedDocument;
  }>
> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("case_documents")
    .select("id, created_at, uploaded_by_user_id, document")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    created_at: item.created_at,
    uploaded_by_user_id: item.uploaded_by_user_id,
    document: item.document as UploadedDocument,
  }));
}

export async function getStatementInternalDocuments(
  statementId: string,
): Promise<
  Array<{
    id: string;
    created_at: string;
    uploaded_by_user_id: string;
    document: UploadedDocument;
  }>
> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("statement_internal_documents")
    .select("id, created_at, uploaded_by_user_id, document")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    created_at: item.created_at,
    uploaded_by_user_id: item.uploaded_by_user_id,
    document: item.document as UploadedDocument,
  }));
}

export async function getStatementReminderRule(statementId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("statement_reminder_rules")
    .select("*")
    .eq("statement_id", statementId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getStatementReminderEvents(
  statementId: string,
  limit = 10,
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("statement_reminder_events")
    .select("id, send_type, status, recipient_email, sent_at, created_at")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getOutstandingWorkSummary(options?: {
  staleDays?: number;
  limit?: number;
}): Promise<OutstandingWorkSummary> {
  const supabase = getSupabaseClient();
  const staleDays = Math.max(1, options?.staleDays ?? 7);
  const limit = Math.max(1, Math.min(50, options?.limit ?? 20));
  const staleSince = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const [
    {
      data: waitingOnWitness,
      count: waitingOnWitnessCount,
      error: witnessError,
    },
    { data: waitingOnReview, count: waitingOnReviewCount, error: reviewError },
    {
      data: overdueReminders,
      count: overdueReminderCount,
      error: reminderError,
    },
    { count: staleCaseCount, error: staleError },
  ] = await Promise.all([
    supabase
      .from("statements")
      .select("id, case_id, title, witness_name, status, updated_at", {
        count: "exact",
      })
      .in("status", ["draft", "in_progress", "finalized"])
      .order("updated_at", { ascending: true })
      .limit(limit),
    supabase
      .from("statements")
      .select("id, case_id, title, witness_name, updated_at", {
        count: "exact",
      })
      .eq("status", "submitted")
      .order("updated_at", { ascending: true })
      .limit(limit),
    supabase
      .from("statement_reminder_rules")
      .select(
        "id, statement_id, next_send_at, reminders_sent_count, max_reminders",
        {
          count: "exact",
        },
      )
      .eq("is_enabled", true)
      .lte("next_send_at", new Date().toISOString())
      .order("next_send_at", { ascending: true })
      .limit(limit),
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "in_progress"])
      .lt("updated_at", staleSince.toISOString()),
  ]);

  if (witnessError) throw witnessError;
  if (reviewError) throw reviewError;
  if (reminderError) throw reminderError;
  if (staleError) throw staleError;

  const caseIds = uniqueIds([
    ...(waitingOnWitness ?? []).map((item) => item.case_id),
    ...(waitingOnReview ?? []).map((item) => item.case_id),
  ]);

  const { data: cases, error: casesError } = caseIds.length
    ? await supabase.from("cases").select("id, title").in("id", caseIds)
    : { data: [], error: null };

  if (casesError) {
    throw casesError;
  }

  const caseTitleMap = new Map((cases ?? []).map((c) => [c.id, c.title]));

  return {
    waitingOnWitnessCount: waitingOnWitnessCount ?? 0,
    waitingOnReviewCount: waitingOnReviewCount ?? 0,
    overdueReminderCount: overdueReminderCount ?? 0,
    staleCaseCount: staleCaseCount ?? 0,
    waitingOnWitness: (waitingOnWitness ?? []).map((item) => ({
      statementId: item.id,
      caseId: item.case_id,
      caseTitle: caseTitleMap.get(item.case_id) ?? item.title,
      witnessName: item.witness_name,
      status: item.status,
      updatedAt: item.updated_at,
    })),
    waitingOnReview: (waitingOnReview ?? []).map((item) => ({
      statementId: item.id,
      caseId: item.case_id,
      caseTitle: caseTitleMap.get(item.case_id) ?? item.title,
      witnessName: item.witness_name,
      updatedAt: item.updated_at,
    })),
    overdueReminders: (overdueReminders ?? []).map((item) => ({
      reminderRuleId: item.id,
      statementId: item.statement_id,
      nextSendAt: item.next_send_at,
      remindersSentCount: item.reminders_sent_count,
      maxReminders: item.max_reminders,
    })),
  };
}

export async function getUnifiedActivityTimeline(input: {
  caseId?: string;
  statementId?: string;
  limit?: number;
}): Promise<UnifiedTimelineEvent[]> {
  const supabase = getSupabaseClient();
  const limit = Math.max(1, Math.min(250, input.limit ?? 100));

  const statementIds: string[] = [];
  if (input.statementId) {
    statementIds.push(input.statementId);
  } else if (input.caseId) {
    const { data: caseStatements, error: caseStatementsError } = await supabase
      .from("statements")
      .select("id")
      .eq("case_id", input.caseId);

    if (caseStatementsError) {
      throw caseStatementsError;
    }

    statementIds.push(...(caseStatements ?? []).map((item) => item.id));
  }

  const isTenantWide = !input.caseId && !input.statementId;
  const statementIdSet = new Set(statementIds);

  const getMetaId = (
    metadata: unknown,
    branch: "new" | "old",
    key: "case_id" | "statement_id",
  ): string | null => {
    if (!metadata || typeof metadata !== "object") return null;
    const branchValue = (metadata as Record<string, unknown>)[branch];
    if (!branchValue || typeof branchValue !== "object") return null;
    const id = (branchValue as Record<string, unknown>)[key];
    return typeof id === "string" && id.length > 0 ? id : null;
  };

  const isRelevantAuditEvent = (item: {
    target_type: string | null;
    target_id: string | null;
    metadata: unknown;
  }): boolean => {
    if (isTenantWide) return true;

    const targetType = item.target_type ?? "";
    const targetId = item.target_id ?? null;

    const candidateCaseIds = [
      targetType === "cases" ? targetId : null,
      getMetaId(item.metadata, "new", "case_id"),
      getMetaId(item.metadata, "old", "case_id"),
    ].filter((value): value is string => !!value);

    const candidateStatementIds = [
      targetType === "statements" ? targetId : null,
      getMetaId(item.metadata, "new", "statement_id"),
      getMetaId(item.metadata, "old", "statement_id"),
    ].filter((value): value is string => !!value);

    if (
      input.statementId &&
      candidateStatementIds.includes(input.statementId)
    ) {
      return true;
    }

    if (input.caseId) {
      if (candidateCaseIds.includes(input.caseId)) {
        return true;
      }

      if (candidateStatementIds.some((id) => statementIdSet.has(id))) {
        return true;
      }
    }

    return false;
  };

  const [caseNotesRes, statementNotesRes, reminderEventsRes, auditRes] =
    await Promise.all([
      input.caseId
        ? supabase
            .from("case_notes")
            .select("id, case_id, author_user_id, body, created_at")
            .eq("case_id", input.caseId)
            .order("created_at", { ascending: false })
            .limit(limit)
        : isTenantWide
          ? supabase
              .from("case_notes")
              .select("id, case_id, author_user_id, body, created_at")
              .order("created_at", { ascending: false })
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
      statementIds.length
        ? supabase
            .from("statement_notes")
            .select("id, statement_id, author_user_id, body, created_at")
            .in("statement_id", statementIds)
            .order("created_at", { ascending: false })
            .limit(limit)
        : isTenantWide
          ? supabase
              .from("statement_notes")
              .select("id, statement_id, author_user_id, body, created_at")
              .order("created_at", { ascending: false })
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
      statementIds.length
        ? supabase
            .from("statement_reminder_events")
            .select(
              "id, statement_id, created_by_user_id, send_type, status, metadata, created_at",
            )
            .in("statement_id", statementIds)
            .order("created_at", { ascending: false })
            .limit(limit)
        : isTenantWide
          ? supabase
              .from("statement_reminder_events")
              .select(
                "id, statement_id, created_by_user_id, send_type, status, metadata, created_at",
              )
              .order("created_at", { ascending: false })
              .limit(limit)
          : Promise.resolve({ data: [], error: null }),
      supabase
        .from("audit_logs")
        .select(
          "id, actor_user_id, target_type, target_id, action, metadata, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(isTenantWide ? limit : Math.min(500, limit * 10)),
    ]);

  if (caseNotesRes.error) throw caseNotesRes.error;
  if (statementNotesRes.error) throw statementNotesRes.error;
  if (reminderEventsRes.error) throw reminderEventsRes.error;
  if (auditRes.error) throw auditRes.error;

  const caseNoteEvents: UnifiedTimelineEvent[] = (caseNotesRes.data ?? []).map(
    (item) => ({
      id: `case-note:${item.id}`,
      type: "case_note",
      createdAt: item.created_at,
      actorUserId: item.author_user_id,
      caseId: item.case_id,
      statementId: null,
      title: "Case note added",
      description: item.body,
      metadata: {},
    }),
  );

  const statementNoteEvents: UnifiedTimelineEvent[] = (
    statementNotesRes.data ?? []
  ).map((item) => ({
    id: `statement-note:${item.id}`,
    type: "statement_note",
    createdAt: item.created_at,
    actorUserId: item.author_user_id,
    caseId: input.caseId ?? null,
    statementId: item.statement_id,
    title: "Statement note added",
    description: item.body,
    metadata: {},
  }));

  const reminderEvents: UnifiedTimelineEvent[] = (
    reminderEventsRes.data ?? []
  ).map((item) => ({
    id: `reminder:${item.id}`,
    type: "reminder_event",
    createdAt: item.created_at,
    actorUserId: item.created_by_user_id,
    caseId: input.caseId ?? null,
    statementId: item.statement_id,
    title: `Reminder ${item.status}`,
    description: `Type: ${item.send_type}`,
    metadata: (item.metadata ?? {}) as Record<string, unknown>,
  }));

  const auditEvents: UnifiedTimelineEvent[] = (auditRes.data ?? [])
    .filter(isRelevantAuditEvent)
    .map((item) => ({
      id: `audit:${item.id}`,
      type: "audit",
      createdAt: item.created_at,
      actorUserId: item.actor_user_id,
      caseId:
        item.target_type === "case" ? item.target_id : (input.caseId ?? null),
      statementId:
        item.target_type === "statement"
          ? item.target_id
          : (input.statementId ?? null),
      title: item.action,
      description:
        typeof (item.metadata as Record<string, unknown>)?.message === "string"
          ? ((item.metadata as Record<string, unknown>).message as string)
          : "Audit event",
      metadata: (item.metadata ?? {}) as Record<string, unknown>,
    }));

  const events = [
    ...caseNoteEvents,
    ...statementNoteEvents,
    ...reminderEvents,
    ...auditEvents,
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);

  const actorIds = uniqueIds(
    events.map((event) => event.actorUserId).filter((id): id is string => !!id),
  );

  if (!actorIds.length) {
    return events;
  }

  const { data: actorProfiles, error: actorProfilesError } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", actorIds);

  if (actorProfilesError) {
    throw actorProfilesError;
  }

  const actorNameMap = new Map(
    (actorProfiles ?? []).map((profile) => [
      profile.user_id,
      profile.display_name || profile.user_id,
    ]),
  );

  return events.map((event) => ({
    ...event,
    actorName: event.actorUserId
      ? (actorNameMap.get(event.actorUserId) ?? event.actorUserId)
      : null,
  }));
}
