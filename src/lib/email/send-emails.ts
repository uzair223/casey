import { Resend } from "resend";
import { getAuthURL } from "../utils";
import { getServiceClient } from "../supabase/server";
import type {
  MentionNotificationPayload,
  StatementReminderEmailPayload,
  StatementFollowUpRequestPayload,
  StatementEmailPayload,
  StatementSubmittedNotificationPayload,
} from "@/types";
import {
  buildStatementReminderEmailTemplate,
  buildStatementFollowUpRequestTemplate,
  buildInvitationEmailTemplate,
  buildMentionNotificationEmailTemplate,
  buildStatementLinkEmailTemplate,
  buildStatementSubmittedNotificationTemplate,
} from "./templates";

// Resend integration: Requires RESEND_API_KEY and RESEND_FROM in environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

const getResendFrom = () => {
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error("Missing RESEND_FROM environment variable.");
  }
  return from;
};

export const sendStatementLinkEmail = async (
  payload: StatementEmailPayload,
) => {
  const template = buildStatementLinkEmailTemplate(payload);
  const from = `${payload.tenantName} | ${getResendFrom()}`;
  await resend.emails.send({
    from,
    to: payload.to,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};

export const sendExistingUserSignInEmail = async ({
  email,
  token,
}: {
  email: string;
  token: string;
}) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: getAuthURL(token),
    },
  });

  if (error) {
    throw error;
  }

  const actionLink = data?.properties?.action_link;

  if (!actionLink) {
    throw new Error("Failed to generate sign-in link");
  }

  const template = buildInvitationEmailTemplate({
    url: actionLink,
  });

  await resend.emails.send({
    from: getResendFrom(),
    to: email,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};

const sendNewUserInviteEmail = async ({
  email,
  token,
}: {
  email: string;
  token: string;
}) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: getAuthURL(token),
    },
  });

  if (error) {
    throw error;
  }

  const actionLink = data?.properties?.action_link;

  if (!actionLink) {
    throw new Error("Failed to generate invite link");
  }

  const template = buildInvitationEmailTemplate({
    url: actionLink,
  });

  await resend.emails.send({
    from: getResendFrom(),
    to: email,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};

export const sendInvitationEmail = async ({
  email,
  token,
}: {
  email: string;
  token: string;
}) => {
  try {
    await sendNewUserInviteEmail({ email, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("has already been registered")) {
      await sendExistingUserSignInEmail({ email, token });
      return;
    }
    throw error;
  }
};

export const sendStatementSubmittedNotificationEmail = async (
  payload: StatementSubmittedNotificationPayload,
) => {
  if (!payload.to.length) return;
  const template = buildStatementSubmittedNotificationTemplate(payload);
  const from = getResendFrom();
  await resend.emails.send({
    from,
    to: payload.to,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};

export const sendStatementFollowUpRequestEmail = async (
  payload: StatementFollowUpRequestPayload,
) => {
  const template = buildStatementFollowUpRequestTemplate(payload);
  const from = `${payload.tenantName} | ${getResendFrom()}`;

  await resend.emails.send({
    from,
    to: payload.to,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};

export const sendStatementReminderEmail = async (
  payload: StatementReminderEmailPayload,
) => {
  const template = buildStatementReminderEmailTemplate(payload);
  const from = `${payload.tenantName} | ${getResendFrom()}`;

  await resend.emails.send({
    from,
    to: payload.to,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};

export const sendMentionNotificationEmail = async (
  payload: MentionNotificationPayload,
) => {
  const template = buildMentionNotificationEmailTemplate(payload);

  await resend.emails.send({
    from: `${payload.tenantName} | ${getResendFrom()}`,
    to: payload.to,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};
