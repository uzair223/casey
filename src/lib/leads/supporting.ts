import "server-only";

import { env } from "@/lib/env";
import { sendStatementLinkEmail } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/server";
import { generateSecureToken } from "@/lib/security";
import { sendSms, smsConfigured } from "@/lib/sms/send";
import { composeSupportingOutreachNote } from "./outreach-note";
import { inferSupportingPeople } from "./supporting-model";
import { parseLeadTypeConfig, supportingRoles } from "./schema";
import { freezeStatementConfig } from "./snapshot";

export async function recordDraftSupportingPeople(statementId: string) {
  const supabase = getServiceClient("draft-supporting-people");
  const { data: primary, error } = await supabase
    .from("statements")
    .select(
      "id, tenant_id, case_id, participant_kind, lead_type_id, contact_email, statement_config_templates!statements_lead_type_id_fkey(participant_roles, qualification_slots, outreach_template, decline_reasons, branding)",
    )
    .eq("id", statementId)
    .maybeSingle();
  if (error) throw error;
  if (!primary || primary.participant_kind !== "primary") return [];

  const leadType = Array.isArray(primary.statement_config_templates)
    ? primary.statement_config_templates[0]
    : primary.statement_config_templates;
  const config = parseLeadTypeConfig(leadType ?? {});
  const roles = supportingRoles(config.participant_roles);
  if (roles.length === 0) return [];

  const { data: messages, error: messageError } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("statement_id", statementId)
    .order("created_at", { ascending: true });
  if (messageError) throw messageError;

  const transcript = (messages ?? [])
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const proposed = await inferSupportingPeople({
    transcript,
    roles: roles.map((role) => ({ key: role.key, label: role.label })),
    claimantEmail: primary.contact_email,
  });

  const created: string[] = [];
  for (const person of proposed) {
    let existingQuery = supabase
      .from("statements")
      .select("id")
      .eq("parent_statement_id", primary.id);
    existingQuery = person.email
      ? existingQuery.ilike("contact_email", person.email)
      : existingQuery.ilike("witness_name", person.name);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
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
      witness_email: person.email || "",
      contact_name: person.name,
      contact_email: person.email || null,
      contact_phone: person.phone || null,
      template_id: role.statement_template_id ?? null,
      witness_metadata: { source: "extracted" },
      status: "extracted",
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
    created.push(person.email || person.name);
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
      "witness_name, statement_config_templates!statements_lead_type_id_fkey(participant_roles)",
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

  const leadType = Array.isArray(primary?.statement_config_templates)
    ? primary?.statement_config_templates[0]
    : primary?.statement_config_templates;
  const config = parseLeadTypeConfig(leadType ?? {});
  const role =
    config.participant_roles.find((item) => item.key === statement.role_key)
      ?.label ?? statement.role_key;
  const firm = tenant?.name ?? "the firm";
  const message = await composeSupportingOutreachNote({
    witnessName: statement.witness_name ?? "",
    clientName: primary?.witness_name ?? "",
    role,
    firm,
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
      tenantName: firm,
      witnessName: statement.witness_name,
      caseTitle: role,
      statementUrl: link,
      firmMessage: message,
      reason: "supporting_outreach",
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

  const nextStatus =
    statement.status === "draft" || statement.status === "extracted"
      ? "waiting_for_response"
      : statement.status;
  const { error: updateError } = await supabase
    .from("statements")
    .update({
      outreach_confirmed_at: new Date().toISOString(),
      status: nextStatus,
    })
    .eq("id", statement.id);
  if (updateError) throw updateError;

  return { alreadySent: false, link };
}
