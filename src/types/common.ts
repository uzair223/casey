import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Tables } from "./supabase.generated";
import type { ResponseMetadata } from "@/lib/schema";
import { CaseConfig, StatementConfig } from "./schema";

export type UploadedDocument = {
  bucketId?: string;
  name: string;
  description?: string;
  path: string;
  type: string;
  uploadedAt: string;
};

export type AccountDeletionRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed";
export type AccountDeletionRequest = Omit<
  Tables<"account_deletion_requests">,
  "status"
> & { status: AccountDeletionRequestStatus };

export type AuditLog = Tables<"audit_logs">;
export type CaseTemplateStatementTemplateRelation =
  Tables<"case_template_statement_templates">;
export type Case = Omit<Tables<"cases">, "case_metadata"> & {
  case_metadata: Record<string, string>;
  case_template_name: string;
};

//#region Message
export type Message = {
  role: "user" | "assistant";
  content: string;
  id?: string;
  meta?: ResponseMetadata;
};
export type ConversationMessage = Tables<"conversation_messages">;
export type MetadataProgress = ResponseMetadata["progress"];
export type MetadataMissingDetails = ResponseMetadata["ignoredMissingDetails"];
export type MetadataEvidence = ResponseMetadata["evidence"];
export type MetadataDeviation = ResponseMetadata["deviation"];
export type MetadataDelta = {
  witnessDetails?: Partial<NonNullable<ResponseMetadata["witnessDetails"]>>;
  progress?: {
    currentPhase?: ResponseMetadata["progress"]["currentPhase"];
    readyToPrepare?: ResponseMetadata["progress"]["readyToPrepare"];
    phaseCompleteness?: Partial<
      ResponseMetadata["progress"]["phaseCompleteness"]
    >;
  };
  ignoredMissingDetails?: ResponseMetadata["ignoredMissingDetails"];
  evidence?: {
    record?: ResponseMetadata["evidence"]["record"];
    requestedEvidence?: ResponseMetadata["evidence"]["requestedEvidence"];
  };
  deviation?: ResponseMetadata["deviation"];
};
//#endregion

export type Invite = Tables<"invites">;
export type MagicLink = Tables<"magic_links">;

export type UserRole =
  | "app_admin"
  | "tenant_admin"
  | "solicitor"
  | "paralegal"
  | "user";
export type Profile = Omit<Tables<"profiles">, "role"> & { role: UserRole };
export type UserProfile = Pick<
  Profile,
  "display_name" | "role" | "tenant_id"
> & { tenant_name: string | null };
export type User = SupabaseUser & UserProfile;

export type StatementConfigSnapshot = Tables<"statement_config_snapshots">;

export type TemplateScope = "global" | "tenant";
export type TemplateStatus = "draft" | "published" | "archived";
export type CaseTemplate = Omit<
  Tables<"case_templates">,
  "template_scope" | "status"
> & {
  status: TemplateStatus;
  template_scope: TemplateScope;
  draft_config: CaseConfig;
  published_config: CaseConfig | null;
};

export type StatementConfigTemplate = Omit<
  Tables<"statement_config_templates">,
  | "scope"
  | "template_scope"
  | "status"
  | "draft_config"
  | "published_config"
  | "docx_template_document"
> & {
  template_scope: TemplateScope;
  status: TemplateStatus;
  draft_config: StatementConfig;
  published_config: StatementConfig | null;
  docx_template_document: UploadedDocument | null;
};
export type PublishedStatementConfigTemplate = Pick<
  StatementConfigTemplate,
  | "id"
  | "name"
  | "template_scope"
  | "published_config"
  | "docx_template_document"
>;

export type StatementStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "locked"
  | "demo"
  | "demo_published";
export type Statement = Omit<
  Tables<"statements">,
  | "status"
  | "sections"
  | "signed_document"
  | "supporting_documents"
  | "witness_metadata"
> & {
  status: StatementStatus;
  sections: Record<string, string>;
  signed_document: UploadedDocument | null;
  supporting_documents: UploadedDocument[];
  witness_metadata: Record<string, string | number | null | undefined>;
};

export type Tenant = Tables<"tenants">;
export type CaseNote = Tables<"case_notes">;
export type StatementNote = Tables<"statement_notes">;
export type CaseNoteMention = Tables<"case_note_mentions">;
export type StatementNoteMention = Tables<"statement_note_mentions">;
export type StatementReminderRule = Tables<"statement_reminder_rules">;
export type StatementReminderEvent = Tables<"statement_reminder_events">;
export type TenantNotificationPreferences =
  Tables<"tenant_notification_preferences">;
export type NotificationChannel = "email" | "in_app" | "both" | "off";
export type NotificationType = "case_note_mention" | "statement_note_mention";
export type UserNotification = {
  id: string;
  tenant_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  notification_type: NotificationType;
  entity_type: "case_note" | "statement_note";
  entity_id: string;
  title: string;
  body: string;
  link_path: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};
export type TenantCaseTemplatePreferences = Omit<
  Tables<"case_template_tenant_preferences">,
  "created_at" | "updated_at"
>;

export type WaitlistSignup = Tables<"waitlist_signups">;

export type StatementDetailed = Omit<Statement, "config_snapshot_id"> & {
  statement_config: StatementConfig;
  template_document_snapshot?: UploadedDocument | null;
  link?: Pick<MagicLink, "token" | "expires_at"> | null;
};

export type CaseStatementJoin = Case & {
  statements: Pick<
    Statement,
    "id" | "status" | "witness_name" | "witness_email"
  >[];
};

export type FullStatementDataResponseBase = {
  tenant_id: string;
  tenant_name: string;
  case: Omit<Case, "tenant_id">;
  statement: Omit<StatementDetailed, "tenant_id" | "case_id">;
};

export type FullStatementDataResponse<T extends boolean = boolean> =
  T extends true
    ? FullStatementDataResponseBase & {
        messages: Message[];
        has_history: boolean;
      }
    : T extends false
      ? FullStatementDataResponseBase & { latest: Message }
      : FullStatementDataResponseBase;

export type StatementDataResponse<T extends boolean = boolean> =
  FullStatementDataResponse<T>;

export type CollaborationNoteView = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_user_id: string;
  is_pinned: boolean;
  pinned_at: string | null;
  pinned_by_user_id: string | null;
  mentions: string[];
};

export type OutstandingWorkSummary = {
  waitingOnWitnessCount: number;
  waitingOnReviewCount: number;
  overdueReminderCount: number;
  staleCaseCount: number;
  waitingOnWitness: Array<{
    statementId: string;
    caseId: string;
    caseTitle: string;
    witnessName: string;
    status: string;
    updatedAt: string;
  }>;
  waitingOnReview: Array<{
    statementId: string;
    caseId: string;
    caseTitle: string;
    witnessName: string;
    updatedAt: string;
  }>;
  overdueReminders: Array<{
    reminderRuleId: string;
    statementId: string;
    nextSendAt: string | null;
    remindersSentCount: number;
    maxReminders: number | null;
  }>;
};

export type UnifiedTimelineEventType =
  | "case_note"
  | "statement_note"
  | "reminder_event"
  | "audit";

export type UnifiedTimelineEvent = {
  id: string;
  type: UnifiedTimelineEventType;
  createdAt: string;
  actorUserId: string | null;
  actorName?: string | null;
  caseId: string | null;
  statementId: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
};
