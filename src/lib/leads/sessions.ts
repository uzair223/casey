import "server-only";

import { createHash, randomInt } from "node:crypto";

import { sendStatementLinkEmail } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/server";
import { generateSecureToken } from "@/lib/security";
import { smsConfigured, sendSms } from "@/lib/sms/send";
import {
  ENQUIRY_DISCARD_REPLY,
  clearRedirectOffer,
  continuingEnquiryDecision,
  declinedLeadTypeIds,
  enquiryClosesWithoutLead,
  evaluateEnquiryRedirectAnswer,
  evaluateEnquiryTurn,
  interpretRedirectAnswer,
  redirectOfferFrom,
  redirectQuestion,
  rememberDeclinedLeadType,
  withRedirectOffer,
} from "@/lib/llm/jev/enquiry-turn";
import { env } from "@/lib/env";
import { listPublishedLeadChannels } from "./channels";
import { enquiryContact, settleEnquiryTurn } from "./enquiry";
import { generateEnquiryTurn } from "./enquiry-model";
import {
  MAX_QUALIFICATION_MESSAGE_CHARS,
  MAX_QUALIFICATION_TURNS,
  MAX_REFUSALS,
  isDisposableEmail,
  refusalReason,
  type SlotAnswers,
} from "./qualify";
import { parseLeadTypeConfig, type QualificationSlot } from "./schema";
import { promoteQualifiedLead } from "./promote";
import { enquiryResumeUrl, enquiryVerificationCode, messageLooksLikeEnquiryCode } from "./resume";

type SessionMessage = { role: "user" | "assistant"; content: string };

function hashCode(sessionId: string, code: string) {
  return createHash("sha256").update(`${sessionId}:${code}`).digest("hex");
}

function asMessages(value: unknown): SessionMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as { role?: unknown; content?: unknown };
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
    ) {
      return [];
    }
    return [{ role: message.role, content: message.content }];
  });
}

function asAnswers(value: unknown): SlotAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "string" ? [[key, entry]] : [],
    ),
  );
}

async function loadSession(token: string) {
  const supabase = getServiceClient("lead-session");
  const { data, error } = await supabase
    .from("lead_sessions")
    .select(
      "id, tenant_id, lead_type_id, channel_id, token, messages, slots, pending_slot_id, turn_count, refusal_count, status, contact_code_hash, contact_code_expires_at, promoted_statement_id, expires_at, statement_config_templates!lead_sessions_lead_type_id_fkey(qualification_slots, participant_roles, outreach_template, decline_reasons, branding, name, brief_guidance), tenants(name, plan, public_slug), lead_channels(public_key)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type PublicEnquirySession =
  | {
      error: string;
      status: 404 | 410;
    }
  | {
      token: string;
      status: string;
      publicKey: string;
      leadTypeName: string;
      messages: SessionMessage[];
    };

export async function loadPublicEnquirySession(token: string): Promise<PublicEnquirySession> {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return { error: "This chat has expired.", status: 404 as const };
  }
  const session = await loadSession(token);
  if (!session) return { error: "This chat has expired.", status: 404 as const };
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return { error: "This chat has expired.", status: 410 as const };
  }
  const leadType = Array.isArray(session.statement_config_templates)
    ? session.statement_config_templates[0]
    : session.statement_config_templates;
  const channel = Array.isArray(session.lead_channels)
    ? session.lead_channels[0]
    : session.lead_channels;
  if (!leadType?.name || !channel?.public_key) {
    return { error: "This chat is unavailable.", status: 404 as const };
  }
  return {
    token: session.token,
    status: session.status,
    publicKey: channel.public_key,
    leadTypeName: leadType.name,
    messages: asMessages(session.messages),
  };
}

export async function createQualificationSession(params: {
  channelId: string;
  tenantId: string;
  leadTypeId: string;
  slots: QualificationSlot[];
  welcome: string;
}) {
  const supabase = getServiceClient("lead-session-create");
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("lead_sessions")
    .insert({
      tenant_id: params.tenantId,
      lead_type_id: params.leadTypeId,
      channel_id: params.channelId,
      token,
      messages: [
        {
          role: "assistant",
          content: params.welcome,
        },
      ],
      slots: {},
      pending_slot_id: null,
      expires_at: expiresAt,
      status: "open",
    })
    .select("token, messages, slots, status")
    .single();
  if (error) throw error;
  return data;
}

async function issueCode(params: {
  sessionId: string;
  sessionToken: string;
  slug: string | null;
  email: string;
  phone: string;
  firmName: string;
}) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const supabase = getServiceClient("lead-session-code");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("lead_sessions")
    .update({
      status: "verify",
      contact_code_hash: hashCode(params.sessionId, code),
      contact_code_expires_at: expiresAt,
    })
    .eq("id", params.sessionId);
  if (error) throw error;

  const devCode = process.env.NODE_ENV === "production" ? undefined : code;
  try {
    if (params.email) {
      await sendStatementLinkEmail({
        to: params.email,
        tenantName: params.firmName,
        witnessName: null,
        caseTitle: "Confirm your enquiry",
        statementUrl: enquiryResumeUrl({
          slug: params.slug,
          token: params.sessionToken,
        }),
        firmMessage: `Your confirmation code is ${code}. It expires in 15 minutes. Enter it in the chat. If you closed the page, use the link in this email to return to the same chat.`,
        reason: "initial_intake",
      });
      return { delivered: true as const, devCode };
    }

    if (params.phone && smsConfigured()) {
      await sendSms(
        params.phone,
        `${params.firmName}: your confirmation code is ${code}. It expires in 15 minutes.`,
      );
      return { delivered: true as const, devCode };
    }
  } catch {
    await supabase
      .from("lead_sessions")
      .update({
        status: "open",
        contact_code_hash: null,
        contact_code_expires_at: null,
      })
      .eq("id", params.sessionId);
    return { delivered: false as const, devCode: undefined };
  }

  await supabase
    .from("lead_sessions")
    .update({
      status: "open",
      contact_code_hash: null,
      contact_code_expires_at: null,
    })
    .eq("id", params.sessionId);
  return { delivered: false as const, devCode: undefined };
}

async function saveQualificationTurn(params: {
  sessionId: string;
  messages: SessionMessage[];
  slots: SlotAnswers;
  turnCount: number;
  refusalCount: number;
  status: string;
  leadTypeId: string;
  channelId: string | null;
}) {
  const supabase = getServiceClient("lead-session-turn");
  const { error } = await supabase
    .from("lead_sessions")
    .update({
      messages: params.messages,
      slots: params.slots,
      pending_slot_id: null,
      turn_count: params.turnCount,
      refusal_count: params.refusalCount,
      status: params.status,
      lead_type_id: params.leadTypeId,
      channel_id: params.channelId,
    })
    .eq("id", params.sessionId);
  if (error) throw error;
  return supabase;
}

export async function takeQualificationTurn(params: {
  token: string;
  message: string;
}) {
  const session = await loadSession(params.token);
  if (!session) return { error: "This chat has expired.", status: 404 as const };
  if (new Date(session.expires_at).getTime() < Date.now()) {
    return { error: "This chat has expired.", status: 410 as const };
  }
  if (session.status === "closed" || session.status === "promoted") {
    return { error: "This chat is closed.", status: 409 as const };
  }

  const leadType = Array.isArray(session.statement_config_templates)
    ? session.statement_config_templates[0]
    : session.statement_config_templates;
  const tenant = Array.isArray(session.tenants) ? session.tenants[0] : session.tenants;
  if (!leadType || !tenant) {
    return { error: "This chat is unavailable.", status: 404 as const };
  }

  const config = parseLeadTypeConfig(leadType);
  const trimmed = params.message.trim().slice(0, MAX_QUALIFICATION_MESSAGE_CHARS);
  if (!trimmed) {
    return { error: "Write a message first.", status: 400 as const };
  }

  if (session.status === "verify") {
    const code = enquiryVerificationCode(trimmed);
    if (code) return confirmQualificationCode({ token: params.token, code });
  }

  const strayCode =
    session.status !== "verify" &&
    (enquiryVerificationCode(trimmed) === trimmed ||
      (session.turn_count === 0 && messageLooksLikeEnquiryCode(trimmed)));
  if (strayCode) {
    const reply =
      "That code belongs to the chat that sent it. Open the link in the email to return to that chat, then enter the code there.";
    const history = asMessages(session.messages);
    const transcript = [...history, { role: "user" as const, content: trimmed }];
    await saveQualificationTurn({
      sessionId: session.id,
      messages: [...transcript, { role: "assistant", content: reply }],
      slots: asAnswers(session.slots),
      turnCount: session.turn_count + 1,
      refusalCount: session.refusal_count,
      status: session.status,
      leadTypeId: session.lead_type_id,
      channelId: session.channel_id,
    });
    return {
      reply,
      status: session.status,
      needsVerification: false,
      closed: false,
      fallback: false,
    };
  }

  if (session.turn_count >= MAX_QUALIFICATION_TURNS) {
    await getServiceClient("lead-session-close")
      .from("lead_sessions")
      .update({ status: "closed" })
      .eq("id", session.id);
    return {
      error: "This chat has reached its limit. Leave your details on the form.",
      status: 429 as const,
      fallback: true,
    };
  }

  const answersSoFar = asAnswers(session.slots);
  const history = asMessages(session.messages);
  const transcript = [...history, { role: "user" as const, content: trimmed }];
  const userTranscript = transcript
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
  const channels = await listPublishedLeadChannels(session.tenant_id);
  let answers = { ...answersSoFar };
  let active = {
    leadTypeId: session.lead_type_id,
    channelId: session.channel_id,
    leadTypeName: leadType.name,
    slots: config.qualification_slots,
  };
  let switched = false;
  let note: string | undefined;
  const offer = redirectOfferFrom(answers);
  if (offer) {
    const offered = channels.find(
      (channel) =>
        channel.leadTypeId === offer.leadTypeId &&
        channel.channelId === offer.channelId,
    );
    let verdict = offered ? interpretRedirectAnswer(trimmed) : "no";
    if (offered && verdict === "unclear") {
      const accepted = await evaluateEnquiryRedirectAnswer({
        message: trimmed,
        currentLeadTypeName: leadType.name,
        offeredLeadTypeName: offered.leadTypeName,
      });
      verdict = accepted === true ? "yes" : accepted === false ? "no" : "unclear";
    }
    if (verdict === "yes" && offered) {
      active = {
        leadTypeId: offered.leadTypeId,
        channelId: offered.channelId,
        leadTypeName: offered.leadTypeName,
        slots: offered.config.qualification_slots,
      };
      switched = true;
      answers = clearRedirectOffer(answers);
      note = `The visitor confirmed this enquiry should continue as ${offered.leadTypeName}. Continue the account under that type. Do not ask them to confirm the type again.`;
    } else {
      answers = rememberDeclinedLeadType(answers, offer.leadTypeId);
      if (verdict === "no") {
        note = `The visitor wants to keep this as ${leadType.name}. Continue that account. Do not ask them to switch enquiry type again.`;
      }
    }
  }

  const decision = switched
    ? continuingEnquiryDecision()
    : await evaluateEnquiryTurn({
        currentLeadTypeId: active.leadTypeId,
        currentLeadTypeName: active.leadTypeName,
        leadTypes: channels.map((channel) => ({
          id: channel.leadTypeId,
          name: channel.leadTypeName,
          channelId: channel.channelId,
        })),
        declinedLeadTypeIds: declinedLeadTypeIds(answers),
        messages: transcript,
        latestUserMessage: trimmed,
      });
  const nextCount = session.turn_count + 1;
  const leadTypeChanged = active.leadTypeName !== leadType.name;

  if (enquiryClosesWithoutLead(decision)) {
    const reply = ENQUIRY_DISCARD_REPLY;
    await saveQualificationTurn({
      sessionId: session.id,
      messages: [...transcript, { role: "assistant", content: reply }],
      slots: answers,
      turnCount: nextCount,
      refusalCount: session.refusal_count,
      status: "closed",
      leadTypeId: active.leadTypeId,
      channelId: active.channelId,
    });
    return {
      reply,
      status: "closed" as const,
      needsVerification: false,
      closed: true,
      fallback: false,
      discarded: true,
    };
  }

  const refusal = refusalReason(trimmed);
  if (refusal && !switched) {
    const refusalCount = session.refusal_count + 1;
    const closed = refusalCount >= MAX_REFUSALS;
    const reply = "I can only take the details this enquiry needs.";
    await saveQualificationTurn({
      sessionId: session.id,
      messages: [...transcript, { role: "assistant", content: reply }],
      slots: answers,
      turnCount: nextCount,
      refusalCount,
      status: closed ? "closed" : "open",
      leadTypeId: active.leadTypeId,
      channelId: active.channelId,
    });
    return {
      reply,
      status: closed ? ("closed" as const) : ("open" as const),
      needsVerification: false,
      closed,
      fallback: closed,
    };
  }

  if (decision.redirect) {
    const reply = redirectQuestion(active.leadTypeName, decision.redirect.name);
    answers = withRedirectOffer(answers, {
      leadTypeId: decision.redirect.id,
      channelId: decision.redirect.channelId,
    });
    await saveQualificationTurn({
      sessionId: session.id,
      messages: [...transcript, { role: "assistant", content: reply }],
      slots: answers,
      turnCount: nextCount,
      refusalCount: session.refusal_count,
      status: "open",
      leadTypeId: active.leadTypeId,
      channelId: active.channelId,
    });
    return {
      reply,
      status: "open" as const,
      needsVerification: false,
      closed: false,
      fallback: false,
    };
  }

  const wrapUp =
    decision.usedJev &&
    decision.action === "end" &&
    decision.disposition === "send_to_firm";
  if (wrapUp) {
    note = [
      note,
      "The conversation should end. Write the overview when what happened, when, and what followed are clear. Ask only for the one missing piece, if any. Do not keep interviewing and do not ask them to change enquiry type.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const extraction = await generateEnquiryTurn({
    firmName: tenant.name,
    leadTypeName: active.leadTypeName,
    slots: active.slots,
    answers,
    messages: transcript,
    note,
  });
  const turn = settleEnquiryTurn({
    slots: active.slots,
    answers,
    message: trimmed,
    transcript: userTranscript,
    extraction,
    wrapUp,
  });
  const messages = [
    ...transcript,
    { role: "assistant" as const, content: turn.reply },
  ];
  answers = turn.answers;
  const contact = enquiryContact(active.slots, answers);
  if (normalizePlanTrial(tenant.plan) && contact.email && isDisposableEmail(contact.email)) {
    return { error: "Use a regular email address.", status: 400 as const };
  }
  const verify = turn.readyToVerify;

  const supabase = await saveQualificationTurn({
    sessionId: session.id,
    messages,
    slots: answers,
    turnCount: nextCount,
    refusalCount: session.refusal_count,
    status: verify ? "verify" : "open",
    leadTypeId: active.leadTypeId,
    channelId: active.channelId,
  });

  let devCode: string | undefined;
  let reply = turn.reply;
  let needsVerification = verify;
  if (verify) {
    const issued = await issueCode({
      sessionId: session.id,
      sessionToken: session.token,
      slug: tenant.public_slug,
      email: contact.email,
      phone: contact.phone,
      firmName: tenant.name,
    });
    devCode = issued.devCode;
    if (!issued.delivered) {
      await supabase
        .from("lead_sessions")
        .update({
          status: "open",
          pending_slot_id: null,
          slots: { ...answers, awaiting_contact: "true" },
        })
        .eq("id", session.id);
      needsVerification = false;
      reply = "I could not send a code. What email address should the firm use?";
    }
  }

  return {
    reply,
    status: needsVerification ? "verify" : "open",
    needsVerification,
    closed: false,
    fallback: false,
    devCode,
    ...(leadTypeChanged ? { leadTypeName: active.leadTypeName } : {}),
  };
}

function normalizePlanTrial(plan: string | null | undefined) {
  return !plan || plan === "trial";
}

export async function confirmQualificationCode(params: {
  token: string;
  code: string;
}) {
  const session = await loadSession(params.token);
  if (!session) return { error: "This chat has expired.", status: 404 as const };
  if (session.status !== "verify" || !session.contact_code_hash) {
    return { error: "There is no code to confirm yet.", status: 409 as const };
  }
  if (
    !session.contact_code_expires_at ||
    new Date(session.contact_code_expires_at).getTime() < Date.now()
  ) {
    return { error: "That code has expired.", status: 410 as const };
  }
  if (hashCode(session.id, params.code.trim()) !== session.contact_code_hash) {
    return { error: "That code does not match.", status: 400 as const };
  }

  const leadType = Array.isArray(session.statement_config_templates)
    ? session.statement_config_templates[0]
    : session.statement_config_templates;
  const tenant = Array.isArray(session.tenants) ? session.tenants[0] : session.tenants;
  if (!leadType || !tenant) {
    return { error: "This chat is unavailable.", status: 404 as const };
  }

  const promoted = await promoteQualifiedLead({
    tenantId: session.tenant_id,
    tenantName: tenant.name,
    leadTypeId: session.lead_type_id,
    leadTypeName: leadType.name,
    config: parseLeadTypeConfig(leadType),
    answers: asAnswers(session.slots),
    plan: tenant.plan,
    messages: asMessages(session.messages),
  });

  const supabase = getServiceClient("lead-session-promote");
  const transcript = asMessages(session.messages);
  const reply = await deliverIntakeLink(supabase, {
    statementId: promoted.statementId,
    tenantName: tenant.name,
  });

  const { error } = await supabase
    .from("lead_sessions")
    .update({
      status: "promoted",
      promoted_statement_id: promoted.statementId,
      messages: [...transcript, { role: "assistant", content: reply }],
    })
    .eq("id", session.id);
  if (error) throw error;

  return {
    reply,
    promoted: true,
    duplicate: promoted.duplicate,
    statementId: promoted.statementId,
  };
}

const INTAKE_LINK_EMAIL_REPLY =
  "Thanks. I've emailed you a link to give your full account when you're ready. You can close this chat.";
const INTAKE_LINK_SMS_REPLY =
  "Thanks. I've texted you a link to give your full account when you're ready. You can close this chat.";
const INTAKE_LINK_FAILED_REPLY =
  "Your enquiry is with the firm, but the link to your full account could not be sent. Ask them to resend it.";

async function deliverIntakeLink(
  supabase: ReturnType<typeof getServiceClient>,
  params: { statementId: string; tenantName: string },
) {
  const { data: statement, error } = await supabase
    .from("statements")
    .select(
      "id, tenant_id, status, title, witness_name, contact_email, contact_phone",
    )
    .eq("id", params.statementId)
    .maybeSingle();
  if (error) throw error;
  if (!statement) return INTAKE_LINK_FAILED_REPLY;

  const token = await currentIntakeToken(supabase, statement.id, statement.tenant_id);
  if (!token) return INTAKE_LINK_FAILED_REPLY;

  const statementUrl = `${env.NEXT_PUBLIC_BASE_URL}/intake/${token}`;
  const firmMessage =
    "You can give your full account on this link whenever you are ready. You do not have to finish it now.";
  try {
    if (statement.contact_email) {
      await sendStatementLinkEmail({
        to: statement.contact_email,
        tenantName: params.tenantName,
        witnessName: statement.witness_name,
        caseTitle: statement.title || "Your account",
        statementUrl,
        firmMessage,
        reason: "when_ready",
      });
      await markWaitingForResponse(supabase, statement.id, statement.status);
      return INTAKE_LINK_EMAIL_REPLY;
    }

    if (statement.contact_phone && smsConfigured()) {
      const sms = await sendSms(
        statement.contact_phone,
        `${params.tenantName}: your full account is ready when you are. ${statementUrl}`,
      );
      if (sms.sent) {
        await markWaitingForResponse(supabase, statement.id, statement.status);
        return INTAKE_LINK_SMS_REPLY;
      }
    }
  } catch {
    return INTAKE_LINK_FAILED_REPLY;
  }

  return INTAKE_LINK_FAILED_REPLY;
}

async function currentIntakeToken(
  supabase: ReturnType<typeof getServiceClient>,
  statementId: string,
  tenantId: string,
) {
  const { data: link, error } = await supabase
    .from("magic_links")
    .select("token, expires_at")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (link?.token && new Date(link.expires_at).getTime() > Date.now()) {
    return link.token;
  }

  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const { error: insertError } = await supabase.from("magic_links").insert({
    token,
    statement_id: statementId,
    tenant_id: tenantId,
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) throw insertError;
  return token;
}

async function markWaitingForResponse(
  supabase: ReturnType<typeof getServiceClient>,
  statementId: string,
  status: string,
) {
  if (status !== "draft" && status !== "extracted") return;
  const { error } = await supabase
    .from("statements")
    .update({ status: "waiting_for_response" })
    .eq("id", statementId)
    .eq("status", status);
  if (error) throw error;
}

export async function storeFallbackEnquiry(params: {
  tenantId: string;
  leadTypeId: string;
  leadTypeName: string;
  name: string;
  email: string;
  phone: string;
  summary: string;
  plan: string | null;
  config: ReturnType<typeof parseLeadTypeConfig>;
}) {
  return promoteQualifiedLead({
    tenantId: params.tenantId,
    tenantName: "",
    leadTypeId: params.leadTypeId,
    leadTypeName: params.leadTypeName,
    config: params.config,
    answers: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      summary: params.summary,
      unverified: "true",
    },
    plan: params.plan,
    unverified: true,
  });
}
