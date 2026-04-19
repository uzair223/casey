import { env } from "../env";
import { Resend } from "resend";
import { getAuthURL } from "../utils";
import { getServiceClient } from "../supabase/server";
import { logServerEvent } from "@/lib/observability/logger";
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
  buildSignInEmailTemplate,
  buildMentionNotificationEmailTemplate,
  buildStatementLinkEmailTemplate,
  buildStatementSubmittedNotificationTemplate,
} from "./templates";

// Resend integration: Requires RESEND_API_KEY and RESEND_FROM in environment variables
const resend = new Resend(env.RESEND_API_KEY);

const getResendFrom = () => {
  const from = env.RESEND_FROM;
  if (!from) {
    throw new Error("Missing RESEND_FROM environment variable.");
  }
  return from;
};

const toRecipientList = (to: string | string[]) =>
  (Array.isArray(to) ? to : [to]).filter(Boolean);

const toRecipientDomains = (to: string | string[]) => {
  return Array.from(
    new Set(
      toRecipientList(to)
        .map((email) => {
          const at = email.lastIndexOf("@");
          return at > -1 ? email.slice(at + 1).toLowerCase() : null;
        })
        .filter((domain): domain is string => Boolean(domain)),
    ),
  ).slice(0, 5);
};

const sendEmailWithLogging = async (
  emailType: string,
  payload: Parameters<typeof resend.emails.send>[0],
) => {
  const startedAt = Date.now();

  try {
    const result = await resend.emails.send(payload);
    const providerError = (
      result as { error?: { message?: string | null } | null }
    ).error;

    if (providerError) {
      throw new Error(
        providerError.message ?? "Email provider returned an error",
      );
    }

    await logServerEvent("info", "email.send.succeeded", {
      provider: "resend",
      emailType,
      subject: payload.subject,
      recipientCount: toRecipientList(payload.to).length,
      recipientDomains: toRecipientDomains(payload.to),
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    await logServerEvent("error", "email.send.failed", {
      provider: "resend",
      emailType,
      subject: payload.subject,
      recipientCount: toRecipientList(payload.to).length,
      recipientDomains: toRecipientDomains(payload.to),
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
};

export const sendStatementLinkEmail = async (
  payload: StatementEmailPayload,
) => {
  const template = buildStatementLinkEmailTemplate(payload);
  const from = `${payload.tenantName} | ${getResendFrom()}`;
  await sendEmailWithLogging("statement.link", {
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

  const template = buildSignInEmailTemplate({
    url: actionLink,
  });

  await sendEmailWithLogging("auth.magic_link", {
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

  await sendEmailWithLogging("invite.new_user", {
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
  await sendEmailWithLogging("statement.submitted_notification", {
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

  await sendEmailWithLogging("statement.follow_up_request", {
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

  await sendEmailWithLogging("statement.reminder", {
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

  await sendEmailWithLogging("mention.notification", {
    from: `${payload.tenantName} | ${getResendFrom()}`,
    to: payload.to,
    subject: template.subject,
    text: template.text,
    react: template.react,
  });
};
