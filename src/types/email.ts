export type StatementEmailPayload = {
  to: string;
  tenantName: string;
  witnessName: string | null;
  caseTitle: string;
  statementUrl: string;
  firmMessage?: string | null;
  reason?:
    | "initial_intake"
    | "back_to_review"
    | "when_ready"
    | "supporting_outreach";
};

export type StatementSubmittedNotificationPayload = {
  to: string[];
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
};

export type StatementFollowUpRequestPayload = {
  to: string;
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
  statementUrl: string;
  requestedBy: string;
  message: string;
};

export type StatementFinalReviewRequestPayload = {
  to: string;
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
  reviewUrl: string;
  firmMessage?: string | null;
};

export type StatementReminderEmailPayload = {
  to: string;
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
  statementUrl: string;
};

export type MentionNotificationPayload = {
  to: string;
  tenantName: string;
  actorName: string;
  caseTitle: string;
  noteType: "case_note" | "statement_note";
  noteExcerpt: string;
  url: string;
};

export type InvitationEmailPayload = {
  url: string;
};

export type WitnessChatNoticePayload = {
  to: string;
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
  url: string;
  excerpt: string;
  kind: "message" | "reminder";
};

export type WitnessFileDeadlinePayload = {
  to: string;
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
  url: string;
  label: string;
  dueAt: string;
  kind: "upcoming" | "due" | "overdue";
};

export type WitnessChatFirmNoticePayload = {
  to: string;
  tenantName: string;
  caseTitle: string;
  witnessName: string | null;
  url: string;
  excerpt: string;
};
