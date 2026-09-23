export type AuditFieldChange = {
  field?: unknown;
  old?: unknown;
  new?: unknown;
};

export type AuditTimelineRow = {
  action: string;
  target_type?: string | null;
  metadata?: unknown;
};

export type FormattedAuditEvent = {
  title: string;
  description: string;
};

const HIDDEN_TABLES = new Set([
  "case_notes",
  "case_note_mentions",
  "conversation_messages",
  "magic_links",
  "ai_generation_jobs",
  "user_notifications",
  "api_rate_limits",
  "statement_reminder_events",
  "statement_signature_events",
  "waitlist_signups",
  "product_feedback",
  "tenant_notification_preferences",
  "case_templates",
  "statement_templates",
  "case_template_versions",
  "case_template_tenant_preferences",
  "invites",
  "profiles",
  "tenants",
]);

const HIDDEN_TABLE_SUFFIXES = ["_snapshots"];

const INTERNAL_FIELDS = new Set([
  "id",
  "tenant_id",
  "case_id",
  "statement_id",
  "created_at",
  "updated_at",
  "config_snapshot_id",
  "case_config_snapshot_id",
  "statement_config_snapshot_id",
  "draft_config",
  "published_config",
  "schema_version",
  "schemaVersion",
  "token",
  "token_hash",
  "hash",
  "content_hash",
]);

const VISIBLE_FIELDS: Record<string, Set<string>> = {
  cases: new Set(["title", "status", "assigned_to", "assigned_to_ids"]),
  statements: new Set(["status", "witness_name", "witness_email"]),
  case_documents: new Set(["document"]),
  statement_supporting_documents: new Set(["title", "document"]),
};

const APP_ACTIONS: Record<
  string,
  (metadata: Record<string, unknown>) => FormattedAuditEvent
> = {
  "invite.email.sent": (metadata) => ({
    title: "Invite sent",
    description: readableString(metadata.email)
      ? `Invite sent to ${readableString(metadata.email)}`
      : "",
  }),
  "statement.signed": () => ({
    title: "Statement signed",
    description: "",
  }),
  "statement.final_review_request.sent": (metadata) => ({
    title: "Final review requested",
    description: recipientDetail(metadata),
  }),
  "statement.follow_up_request.sent": (metadata) => ({
    title: "Follow-up requested",
    description: recipientDetail(metadata),
  }),
  "statement.reminder.sent": (metadata) => ({
    title: "Reminder sent",
    description: recipientDetail(metadata),
  }),
  "team.member.role_updated": (metadata) => ({
    title: "Team member role changed",
    description: readableString(metadata.newRole)
      ? `Role changed to ${humanizeLabel(String(metadata.newRole))}`
      : "",
  }),
  "team.member.removed": () => ({
    title: "Team member removed",
    description: "",
  }),
  "team.member.restored": () => ({
    title: "Team member restored",
    description: "",
  }),
  "profile.self_deleted": () => ({
    title: "Profile deleted",
    description: "",
  }),
  "account_deletion.rejected": () => ({
    title: "Account deletion rejected",
    description: "",
  }),
  "account_deletion.executed": () => ({
    title: "Account deletion completed",
    description: "",
  }),
  "dsar.export.generated": () => ({
    title: "Data export generated",
    description: "",
  }),
  "retention.purge.executed": () => ({
    title: "Retention purge completed",
    description: "",
  }),
};

const STATEMENT_STATUS_TITLES: Record<string, string> = {
  draft: "Person added",
  in_progress: "Account started",
  submitted: "Account sent",
  finalized: "Written draft prepared",
  completed: "Statement completed",
  locked: "Statement locked",
  demo: "Demo statement created",
  demo_published: "Demo statement published",
};

function isHiddenTable(table: string) {
  if (HIDDEN_TABLES.has(table)) return true;
  return HIDDEN_TABLE_SUFFIXES.some((suffix) => table.endsWith(suffix));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getFieldChanges(metadata: Record<string, unknown>): AuditFieldChange[] {
  const raw = metadata.field_changes;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is AuditFieldChange => !!item && typeof item === "object");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || isUuid(trimmed)) return null;
  return trimmed;
}

function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatScalar(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return readableString(value) ? humanizeLabel(value) : null;
  }
  return null;
}

function recipientDetail(metadata: Record<string, unknown>) {
  const recipient = readableString(metadata.recipient) ?? readableString(metadata.email);
  return recipient ? `Sent to ${recipient}` : "";
}

function documentName(value: unknown): string | null {
  if (typeof value === "string") return readableString(value);
  const record = asRecord(value);
  return (
    readableString(record.name) ??
    readableString(record.filename) ??
    readableString(record.original_name) ??
    readableString(record.title)
  );
}

function visibleChanges(table: string, changes: AuditFieldChange[]) {
  const allowlist = VISIBLE_FIELDS[table];
  return changes.filter((change) => {
    const field = typeof change.field === "string" ? change.field : "";
    if (!field || INTERNAL_FIELDS.has(field)) return false;
    return allowlist ? allowlist.has(field) : false;
  });
}

function formatCaseUpdate(changes: AuditFieldChange[]): FormattedAuditEvent | null {
  const visible = visibleChanges("cases", changes);
  if (!visible.length) return null;

  const status = visible.find((change) => change.field === "status");
  const title = visible.find((change) => change.field === "title");
  const assigned = visible.find(
    (change) => change.field === "assigned_to" || change.field === "assigned_to_ids",
  );

  if (visible.length === 1 && status) {
    const from = formatScalar(status.old);
    const to = formatScalar(status.new);
    return {
      title: "Lead status changed",
      description: from && to ? `${from} → ${to}` : (to ?? ""),
    };
  }

  if (visible.length === 1 && title) {
    return {
      title: "Lead renamed",
      description: readableString(title.new) ?? "",
    };
  }

  if (visible.length === 1 && assigned) {
    return {
      title: "Lead assigned",
      description: "",
    };
  }

  const parts = [
    status
      ? `Status ${formatScalar(status.old) ?? "unknown"} → ${formatScalar(status.new) ?? "unknown"}`
      : null,
    title && readableString(title.new) ? `Renamed to ${readableString(title.new)}` : null,
    assigned ? "Assignment updated" : null,
  ].filter(Boolean);

  return {
    title: "Lead updated",
    description: parts.join(". "),
  };
}

function formatStatementUpdate(changes: AuditFieldChange[]): FormattedAuditEvent | null {
  const visible = visibleChanges("statements", changes);
  if (!visible.length) return null;

  const status = visible.find((change) => change.field === "status");
  if (status && typeof status.new === "string") {
    return {
      title: STATEMENT_STATUS_TITLES[status.new] ?? "Statement updated",
      description: "",
    };
  }

  const witnessName = visible.find((change) => change.field === "witness_name");
  if (witnessName && readableString(witnessName.new)) {
    return {
      title: "Person details updated",
      description: readableString(witnessName.new) ?? "",
    };
  }

  return null;
}

function formatInsert(
  table: string,
  metadata: Record<string, unknown>,
): FormattedAuditEvent | null {
  const row = asRecord(metadata.new);

  if (table === "cases") {
    return {
      title: "Lead opened",
      description: readableString(row.title) ?? "",
    };
  }

  if (table === "statements") {
    return {
      title: "Person added",
      description: readableString(row.witness_name) ?? "",
    };
  }

  if (table === "case_documents" || table === "statement_supporting_documents") {
    return {
      title: "Document uploaded",
      description:
        documentName(row.document) ?? readableString(row.title) ?? "",
    };
  }

  return null;
}

function formatTriggerEvent(
  action: string,
  metadata: Record<string, unknown>,
): FormattedAuditEvent | null {
  const [table, operation] = action.split(".");
  if (!table || !operation || isHiddenTable(table)) {
    return null;
  }

  if (operation === "insert") {
    return formatInsert(table, metadata);
  }

  if (operation === "delete") {
    if (table === "cases") return { title: "Lead deleted", description: "" };
    if (table === "statements") {
      return { title: "Person removed", description: "" };
    }
    if (table === "case_documents" || table === "statement_supporting_documents") {
      return { title: "Document removed", description: "" };
    }
    return null;
  }

  if (operation === "update") {
    const changes = getFieldChanges(metadata);
    if (table === "cases") return formatCaseUpdate(changes);
    if (table === "statements") return formatStatementUpdate(changes);
    return null;
  }

  return null;
}

export function formatAuditTimelineEvent(
  row: AuditTimelineRow,
): FormattedAuditEvent | null {
  const action = row.action?.trim();
  if (!action) return null;

  const metadata = asRecord(row.metadata);
  const appFormatter = APP_ACTIONS[action];
  if (appFormatter) {
    return appFormatter(metadata);
  }

  return formatTriggerEvent(action, metadata);
}
