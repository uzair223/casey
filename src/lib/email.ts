import { Resend } from "resend";
import { getAuthURL } from "./utils";
import { getServiceClient } from "./supabase/server";

type StatementEmailPayload = {
  to: string;
  tenantName: string;
  witnessName: string | null;
  caseTitle: string;
  statementUrl: string;
};

type InvitationEmailPayload = {
  to: string;
  token: string;
};

// Resend integration: Requires RESEND_API_KEY and RESEND_FROM in environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

const getResendFrom = () => {
  const from = process.env.RESEND_FROM || "no-reply@casey.com";
  if (!from) {
    throw new Error("Missing RESEND_FROM environment variable.");
  }
  return from;
};

const buildStatementLinkEmailContent = (payload: StatementEmailPayload) => {
  const witnessName = payload.witnessName?.trim() || "there";
  const subject = `Your witness statement intake link from ${payload.tenantName}`;
  const text = `Hello ${witnessName},\n\n${payload.tenantName} has invited you to complete a witness statement for ${payload.caseTitle}.\n\nUse this secure link to continue: ${payload.statementUrl}\n\nIf you did not expect this email, you can ignore it.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${witnessName},</p>
      <p><strong>${payload.tenantName}</strong> has invited you to complete a witness statement for <strong>${payload.caseTitle}</strong>.</p>
      <p>
        Use this secure link to continue:<br />
        <a href="${payload.statementUrl}" target="_blank" rel="noopener noreferrer">${payload.statementUrl}</a>
      </p>
      <p>If you did not expect this email, you can ignore it.</p>
    </div>
  `;

  return { subject, text, html };
};

const buildInvitationEmailContent = (payload: InvitationEmailPayload) => {
  const url = getAuthURL(payload.token);
  const subject = "You have been invited to join Casey";

  const text = `Hello there, you have been invited to join the Casey platform.\n\Accept the invite: ${url}\n\nIf you did not expect this email, you can ignore it.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello there,</p>
      <p>You to have been invited to join the Casey platform.</p>
      <p>
        <a href="${url}" target="_blank" rel="noopener noreferrer">Accept the invite</a>
      </p>
      <p>If you did not expect this email, you can ignore it.</p>
    </div>
  `;

  return { subject, text, html };
};

export const sendStatementLinkEmail = async (
  payload: StatementEmailPayload,
) => {
  const { subject, text, html } = buildStatementLinkEmailContent(payload);
  const from = `${payload.tenantName} | ${getResendFrom()}`;
  await resend.emails.send({
    from,
    to: payload.to,
    subject,
    text,
    html,
  });
};

export const sendInvitationEmailToExisting = async (
  payload: InvitationEmailPayload,
) => {
  const { subject, text, html } = buildInvitationEmailContent(payload);
  const from = getResendFrom();
  await resend.emails.send({
    from,
    to: payload.to,
    subject,
    text,
    html,
  });
};

export const sendInvitationEmail = async ({
  email,
  token,
}: {
  email: string;
  token: string;
}) => {
  const supabase = getServiceClient();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: getAuthURL(token),
  });
  if (error?.message.includes("has already been registered")) {
    await sendInvitationEmailToExisting({
      to: email,
      token: token,
    });
    return;
  }
  if (error) {
    throw error;
  }
};
