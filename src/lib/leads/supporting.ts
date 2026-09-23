import "server-only";

import { env } from "@/lib/env";
import { sendStatementLinkEmail } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/server";
import { generateSecureToken } from "@/lib/security";
import { sendSms, smsConfigured } from "@/lib/sms/send";
import {
  extractSupportingPeople,
  outreachSummary,
  renderOutreachTemplate,
} from "./qualify";
import {
  DEFAULT_OUTREACH_TEMPLATE,
  parseLeadTypeConfig,
  supportingRoles,
} from "./schema";
import { freezeStatementConfig } from "./snapshot";

export async function recordDraftSupportingPeople(statementId: string) {
  const supabase = getServiceClient("draft-supporting-people");
  const { data: primary, error } = await supabase
    .from("statements")
    .select(
      "id, tenant_id, case_id, participant_kind, lead_type_id, contact_email, case_templates(participant_roles, qualification_slots, outreach_template, decline_reasons, branding)",
    )
    .eq("id", statementId)
    .maybeSingle();
  if (error) throw error;
  if (!primary || primary.participant_kind !== "primary") return [];

  const leadType = Array.isArray(primary.case_templates)
    ? primary.case_templates[0]
    : primary.case_templates;
  const config = parseLeadTypeConfig(leadType ?? {});
  const roles = supportingRoles(config.participant_roles);
  if (roles.length === 0) return [];

  const { data: messages, error: messageError } = await supabase
    .from("conversation_messages")
    .select("content")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });
  if (messageError) throw messageError;

  const proposed = extractSupportingPeople({
    transcript: (messages ?? []).map((message) => message.content).join("\n"),
    roleKeys: roles.map((role) => role.key),
  }).filter((person) => person.email !== (primary.contact_email ?? "").toLowerCase());

  const created: string[] = [];
  for (const person of proposed) {
    const { data: existing, error: existingError } = await supabase
      .from("statements")
      .select("id")
      .eq("parent_statement_id", primary.id)
      .ilike("contact_email", person.email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) continue;

    const role = roles.find((item) => item.key === person.roleKey) ?? roles[0];
    const { data: createdRow, error: insertError } = await supabase.from("statements").insert({
      case_id: primary.case_id,
      tenant_id: primary.tenant_id,
      parent_statement_id: primary.id,
      participant_kind: "supporting",
      role_key: role.key,
      lead_type_id: primary.lead_type_id,
      title: `${role.label}: ${person.name}`,
      witness_name: person.name,
      witness_email: person.email,
      contact_name: person.name,
      contact_email: person.email,
      contact_phone: person.phone || null,
      template_id: role.statement_template_id ?? null,
      status: "draft",
    })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.message?.includes("trial_witness_cap")) continue;
      throw insertError;
    }
    await freezeStatementConfig(supabase, {
      statementId: createdRow.id,
      tenantId: primary.tenant_id,
      templateId: role.statement_template_id ?? null,
    });
    created.push(person.email);
  }

  return created;
}

export async function requestSupportingAccount(params: {
  statementId: string;
  tenantId: string;
}) {
  const supabase = getServiceClient("request-supporting-account");
  const { data: statement, error } = await supabase
    .from("statements")
    .select(
      "id, tenant_id, case_id, participant_kind, role_key, witness_name, witness_email, contact_email, contact_phone, parent_statement_id, outreach_confirmed_at, status",
    )
    .eq("id", params.statementId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!statement || statement.participant_kind !== "supporting") {
    throw new Error("Only a supporting person can be contacted this way.");
  }
  if (!statement.parent_statement_id) {
    throw new Error("This person is not linked to a lead.");
  }
  if (statement.outreach_confirmed_at) {
    return { alreadySent: true };
  }

  const { data: primary, error: primaryError } = await supabase
    .from("statements")
    .select(
      "qualification_answers, lead_type_id, case_templates(name, participant_roles, qualification_slots, outreach_template, decline_reasons, branding)",
    )
    .eq("id", statement.parent_statement_id)
    .maybeSingle();
  if (primaryError) throw primaryError;

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("name, plan")
    .eq("id", params.tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;

  const leadType = Array.isArray(primary?.case_templates)
    ? primary?.case_templates[0]
    : primary?.case_templates;
  const config = parseLeadTypeConfig(leadType ?? {});
  const role =
    config.participant_roles.find((item) => item.key === statement.role_key)
      ?.label ?? statement.role_key;
  const answers =
    primary?.qualification_answers &&
    typeof primary.qualification_answers === "object" &&
    !Array.isArray(primary.qualification_answers)
      ? Object.fromEntries(
          Object.entries(primary.qualification_answers).flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value]] : [],
          ),
        )
      : {};
  const message = renderOutreachTemplate({
    template: config.outreach_template || DEFAULT_OUTREACH_TEMPLATE,
    role,
    firm: tenant?.name ?? "the firm",
    summary: outreachSummary(config.qualification_slots, answers),
  });

  const email = statement.contact_email || statement.witness_email;
  const phone = statement.contact_phone;
  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const { error: linkError } = await supabase.from("magic_links").insert({
    token,
    statement_id: statement.id,
    tenant_id: params.tenantId,
    expires_at: expiresAt.toISOString(),
  });
  if (linkError) throw linkError;

  const link = `${env.NEXT_PUBLIC_BASE_URL}/intake/${token}`;
  let sent = false;
  if (email) {
    await sendStatementLinkEmail({
      to: email,
      tenantName: tenant?.name ?? "Casey",
      witnessName: statement.witness_name,
      caseTitle: role,
      statementUrl: link,
      firmMessage: message,
      reason: "initial_intake",
    });
    sent = true;
  }
  if (phone && tenant?.plan === "growth") {
    const sms = smsConfigured()
      ? await sendSms(phone, `${message} ${link}`)
      : { sent: false as const, reason: "sms_not_configured" as const };
    if (sms.sent) sent = true;
    if (!email && !sms.sent) {
      throw new Error("Text messaging is not configured.");
    }
  }
  if (!sent) {
    throw new Error("This person has no email address or text number.");
  }

  const { error: updateError } = await supabase
    .from("statements")
    .update({ outreach_confirmed_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", statement.id);
  if (updateError) throw updateError;

  return { alreadySent: false, link };
}
