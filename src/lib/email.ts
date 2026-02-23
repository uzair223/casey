import nodemailer from "nodemailer";

type StatementEmailPayload = {
  to: string;
  tenantName: string;
  witnessName: string | null;
  caseTitle: string;
  statementUrl: string;
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || "";
  const portRaw = process.env.SMTP_PORT || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || "";

  if (!host || !portRaw || !user || !pass || !from) {
    throw new Error(
      "Missing SMTP configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
    );
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT must be a valid number.");
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
};

const buildEmailContent = (payload: StatementEmailPayload) => {
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

export const sendStatementLinkEmail = async (
  payload: StatementEmailPayload,
) => {
  const { host, port, user, pass, from } = getSmtpConfig();
  const { subject, text, html } = buildEmailContent(payload);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from: `${payload.tenantName} | ${from}`,
    to: payload.to,
    subject,
    text,
    html,
  });
};
