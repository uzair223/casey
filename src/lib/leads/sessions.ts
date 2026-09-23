import "server-only";

import { createHash, randomInt } from "node:crypto";

import { env } from "@/lib/env";
import { sendStatementLinkEmail } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/server";
import { generateSecureToken } from "@/lib/security";
import { smsConfigured, sendSms } from "@/lib/sms/send";
import {
  MAX_QUALIFICATION_MESSAGE_CHARS,
  MAX_QUALIFICATION_TURNS,
  MAX_REFUSALS,
  applyTurn,
  isDisposableEmail,
  openingMessage,
  nextPendingSlot,
  questionFor,
  readyToVerify,
  reservedValue,
  type SlotAnswers,
} from "./qualify";
import { parseLeadTypeConfig, type QualificationSlot } from "./schema";
import { promoteQualifiedLead } from "./promote";

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
      "id, tenant_id, lead_type_id, channel_id, token, messages, slots, pending_slot_id, turn_count, refusal_count, status, contact_code_hash, contact_code_expires_at, promoted_statement_id, expires_at, case_templates(qualification_slots, participant_roles, outreach_template, decline_reasons, branding, name), tenants(name, plan)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createQualificationSession(params: {
  channelId: string;
  tenantId: string;
  leadTypeId: string;
  slots: QualificationSlot[];
}) {
  const supabase = getServiceClient("lead-session-create");
  const token = generateSecureToken();
  const pending = nextPendingSlot(params.slots, {});
  const opening = openingMessage(pending);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("lead_sessions")
    .insert({
      tenant_id: params.tenantId,
      lead_type_id: params.leadTypeId,
      channel_id: params.channelId,
      token,
      messages: [{ role: "assistant", content: opening }],
      slots: {},
      pending_slot_id: pending?.id ?? null,
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
        statementUrl: `${env.NEXT_PUBLIC_BASE_URL}/q`,
        firmMessage: `Your confirmation code is ${code}. It expires in 15 minutes.`,
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

  const leadType = Array.isArray(session.case_templates)
    ? session.case_templates[0]
    : session.case_templates;
  const tenant = Array.isArray(session.tenants) ? session.tenants[0] : session.tenants;
  if (!leadType || !tenant) {
    return { error: "This chat is unavailable.", status: 404 as const };
  }

  const config = parseLeadTypeConfig(leadType);
  const trimmed = params.message.trim().slice(0, MAX_QUALIFICATION_MESSAGE_CHARS);
  if (!trimmed) {
    return { error: "Write a message first.", status: 400 as const };
  }

  if (
    session.status === "verify" &&
    /^\d{6}$/.test(trimmed)
  ) {
    return confirmQualificationCode({ token: params.token, code: trimmed });
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

  const turn = applyTurn({
    slots: config.qualification_slots,
    answers: asAnswers(session.slots),
    pendingSlotId: session.pending_slot_id,
    message: trimmed,
  });
  const messages = [
    ...asMessages(session.messages),
    { role: "user" as const, content: trimmed },
    { role: "assistant" as const, content: turn.reply },
  ];
  const refusalCount = session.refusal_count + (turn.refusal ? 1 : 0);
  const closed = refusalCount >= MAX_REFUSALS;
  const answers = turn.answers;
  if (normalizePlanTrial(tenant.plan)) {
    const email = reservedValue(config.qualification_slots, answers, "email");
    if (email && isDisposableEmail(email)) {
      return { error: "Use a regular email address.", status: 400 as const };
    }
  }
  const verify =
    !closed && readyToVerify(config.qualification_slots, answers) && !turn.pendingSlotId;

  const supabase = getServiceClient("lead-session-turn");
  const { error } = await supabase
    .from("lead_sessions")
    .update({
      messages,
      slots: answers,
      pending_slot_id: turn.pendingSlotId,
      turn_count: session.turn_count + 1,
      refusal_count: refusalCount,
      status: closed ? "closed" : verify ? "verify" : "open",
    })
    .eq("id", session.id);
  if (error) throw error;

  let devCode: string | undefined;
  let reply = turn.reply;
  let needsVerification = verify;
  if (verify) {
    const issued = await issueCode({
      sessionId: session.id,
      email: reservedValue(config.qualification_slots, answers, "email"),
      phone: reservedValue(config.qualification_slots, answers, "phone"),
      firmName: tenant.name,
    });
    devCode = issued.devCode;
    if (!issued.delivered) {
      const emailSlot = config.qualification_slots.find(
        (slot) => slot.reserved === "email",
      );
      await supabase
        .from("lead_sessions")
        .update({
          status: "open",
          pending_slot_id: emailSlot?.id ?? null,
        })
        .eq("id", session.id);
      needsVerification = false;
      reply = emailSlot
        ? questionFor(emailSlot)
        : "Add an email address so we can confirm this enquiry.";
    }
  }

  return {
    reply,
    status: needsVerification ? "verify" : closed ? "closed" : "open",
    needsVerification,
    closed,
    fallback: closed,
    devCode,
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

  const leadType = Array.isArray(session.case_templates)
    ? session.case_templates[0]
    : session.case_templates;
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
  });

  const supabase = getServiceClient("lead-session-promote");
  const { error } = await supabase
    .from("lead_sessions")
    .update({
      status: "promoted",
      promoted_statement_id: promoted.statementId,
    })
    .eq("id", session.id);
  if (error) throw error;

  return {
    reply: promoted.duplicate
      ? "We already have an open enquiry for this contact. The firm can see the latest details."
      : "Thank you. The firm has this enquiry.",
    promoted: true,
    duplicate: promoted.duplicate,
    statementId: promoted.statementId,
  };
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
