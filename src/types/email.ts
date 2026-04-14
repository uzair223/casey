export type StatementEmailPayload = {
  to: string;
  tenantName: string;
  witnessName: string | null;
  caseTitle: string;
  statementUrl: string;
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
