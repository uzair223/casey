import * as React from "react";
import type {
  InvitationEmailPayload,
  MentionNotificationPayload,
  StatementReminderEmailPayload,
  StatementFollowUpRequestPayload,
  StatementEmailPayload,
  StatementSubmittedNotificationPayload,
} from "@/types";

type EmailTemplateContent = {
  subject: string;
  text: string;
  react: React.ReactElement;
};

const getAppName = () => process.env.NEXT_PUBLIC_APP_NAME || "Casey";

const containerStyle: React.CSSProperties = {
  backgroundColor: "#f7f9fc",
  color: "#111827",
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: 0,
  padding: "24px 0",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "640px",
  padding: "24px",
};

const titleStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: "22px",
  fontWeight: 700,
  margin: "0 0 16px",
};

const paragraphStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: 1.7,
  margin: "0 0 12px",
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#111827",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  margin: "8px 0 16px",
  padding: "10px 16px",
  textDecoration: "none",
};

const footerStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: 1.6,
  marginTop: "16px",
};

const EmailLayout = ({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) => (
  <div style={containerStyle}>
    <div style={cardStyle}>
      <h1 style={titleStyle}>{heading}</h1>
      {children}
      <p style={footerStyle}>
        This email was sent by {getAppName()}. If you were not expecting it, you
        can safely ignore it.
      </p>
    </div>
  </div>
);

export const buildStatementLinkEmailTemplate = (
  payload: StatementEmailPayload,
): EmailTemplateContent => {
  const witnessName = payload.witnessName?.trim() || "there";
  const subject = `${payload.caseTitle}: Complete your witness statement`;
  const text = `Hello ${witnessName},\n\n${payload.tenantName} has invited you to complete a witness statement for ${payload.caseTitle}.\n\nUse this secure link to continue: ${payload.statementUrl}\n\nIf you did not expect this email, you can ignore it.`;

  return {
    subject,
    text,
    react: (
      <EmailLayout heading="Witness Statement Intake Link">
        <p style={paragraphStyle}>Hello {witnessName},</p>
        <p style={paragraphStyle}>
          <strong>{payload.tenantName}</strong> has invited you to complete a
          witness statement for <strong>{payload.caseTitle}</strong>.
        </p>
        <a
          href={payload.statementUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonStyle}
        >
          Open Secure Intake Link
        </a>
        <p style={paragraphStyle}>Or copy and paste this URL:</p>
        <p style={paragraphStyle}>{payload.statementUrl}</p>
      </EmailLayout>
    ),
  };
};

export const buildStatementSubmittedNotificationTemplate = (
  payload: StatementSubmittedNotificationPayload,
): EmailTemplateContent => {
  const appName = getAppName();
  const witnessName = payload.witnessName?.trim() || "Unknown witness";
  const subject = `Statement submitted by ${witnessName} | ${payload.caseTitle}`;
  const text = `${witnessName} has submitted a witness statement for ${payload.caseTitle} (${payload.tenantName}).\n\nPlease review the submitted statement in ${appName}.`;

  return {
    subject,
    text,
    react: (
      <EmailLayout heading="Witness Statement Submitted">
        <p style={paragraphStyle}>A witness statement has been submitted.</p>
        <p style={paragraphStyle}>
          <strong>Witness:</strong> {witnessName}
        </p>
        <p style={paragraphStyle}>
          <strong>Case:</strong> {payload.caseTitle}
        </p>
        <p style={paragraphStyle}>
          Please review the submitted statement in {appName}.
        </p>
      </EmailLayout>
    ),
  };
};

export const buildStatementFollowUpRequestTemplate = (
  payload: StatementFollowUpRequestPayload,
): EmailTemplateContent => {
  const witnessName = payload.witnessName?.trim() || "there";
  const subject = `More details requested: ${payload.caseTitle}`;
  const text = `Hello ${witnessName},\n\n${payload.requestedBy} at ${payload.tenantName} has requested additional details for ${payload.caseTitle}.\n\nMessage:\n${payload.message}\n\nUse your secure link to provide updates: ${payload.statementUrl}`;

  return {
    subject,
    text,
    react: (
      <EmailLayout heading="Additional Details Requested">
        <p style={paragraphStyle}>Hello {witnessName},</p>
        <p style={paragraphStyle}>
          {payload.requestedBy} at <strong>{payload.tenantName}</strong> has
          requested additional details for <strong>{payload.caseTitle}</strong>.
        </p>
        <p style={paragraphStyle}>
          <strong>Message:</strong>
        </p>
        <p style={paragraphStyle}>{payload.message}</p>
        <a
          href={payload.statementUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonStyle}
        >
          Open Secure Intake Link
        </a>
        <p style={paragraphStyle}>Or copy and paste this URL:</p>
        <p style={paragraphStyle}>{payload.statementUrl}</p>
      </EmailLayout>
    ),
  };
};

export const buildStatementReminderEmailTemplate = (
  payload: StatementReminderEmailPayload,
): EmailTemplateContent => {
  const witnessName = payload.witnessName?.trim() || "there";
  const subject = `Reminder: Continue your witness statement for ${payload.caseTitle}`;
  const text = `Hello ${witnessName},\n\nThis is a friendly reminder from ${payload.tenantName} to continue your witness statement for ${payload.caseTitle}.\n\nUse your secure link to continue: ${payload.statementUrl}`;

  return {
    subject,
    text,
    react: (
      <EmailLayout heading="Witness Statement Reminder">
        <p style={paragraphStyle}>Hello {witnessName},</p>
        <p style={paragraphStyle}>
          This is a friendly reminder from <strong>{payload.tenantName}</strong>{" "}
          to continue your witness statement for{" "}
          <strong>{payload.caseTitle}</strong>.
        </p>
        <a
          href={payload.statementUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonStyle}
        >
          Open Secure Intake Link
        </a>
        <p style={paragraphStyle}>Or copy and paste this URL:</p>
        <p style={paragraphStyle}>{payload.statementUrl}</p>
      </EmailLayout>
    ),
  };
};

export const buildInvitationEmailTemplate = (
  payload: InvitationEmailPayload,
): EmailTemplateContent => {
  const appName = getAppName();
  const subject = `You have been invited to join ${appName}`;
  const text = `Hello there,\n\nYou have been invited to join ${appName}.\n\nSign in to accept your invite: ${payload.url}\n\nIf you did not expect this email, you can ignore it.`;

  return {
    subject,
    text,
    react: (
      <EmailLayout heading="You Have Been Invited">
        <p style={paragraphStyle}>Hello there,</p>
        <p style={paragraphStyle}>
          You have been invited to join <strong>{appName}</strong>.
        </p>
        <a
          href={payload.url}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonStyle}
        >
          Accept Invite
        </a>
        <p style={paragraphStyle}>Or copy and paste this URL:</p>
        <p style={paragraphStyle}>{payload.url}</p>
      </EmailLayout>
    ),
  };
};

export const buildMentionNotificationEmailTemplate = (
  payload: MentionNotificationPayload,
): EmailTemplateContent => {
  const appName = getAppName();
  const subject = `${payload.actorName} mentioned you in ${payload.caseTitle}`;
  const text = `${payload.actorName} mentioned you in a ${payload.noteType === "case_note" ? "case" : "statement"} note for ${payload.caseTitle} at ${payload.tenantName}.

Note excerpt:
${payload.noteExcerpt}

Open it in ${appName}: ${payload.url}`;

  return {
    subject,
    text,
    react: (
      <EmailLayout heading="You Were Mentioned">
        <p style={paragraphStyle}>
          <strong>{payload.actorName}</strong> mentioned you in a{" "}
          {payload.noteType === "case_note" ? "case" : "statement"} note for{" "}
          <strong>{payload.caseTitle}</strong>.
        </p>
        <p style={paragraphStyle}>
          <strong>Tenant:</strong> {payload.tenantName}
        </p>
        {payload.noteExcerpt ? (
          <>
            <p style={paragraphStyle}>
              <strong>Note excerpt:</strong>
            </p>
            <p style={paragraphStyle}>{payload.noteExcerpt}</p>
          </>
        ) : null}
        <a
          href={payload.url}
          target="_blank"
          rel="noopener noreferrer"
          style={buttonStyle}
        >
          Open Mention
        </a>
      </EmailLayout>
    ),
  };
};
