import "server-only";

import { openTenantCase } from "@/lib/billing/open-case";
import { getServiceClient } from "@/lib/supabase/server";
import { isDisposableEmail, reservedValue, type SlotAnswers } from "./qualify";
import {
  primaryRole,
  type LeadTypeConfig,
} from "./schema";

function contactFromAnswers(config: LeadTypeConfig, answers: SlotAnswers) {
  return {
    name:
      reservedValue(config.qualification_slots, answers, "name") ||
      answers.name ||
      "",
    email:
      reservedValue(config.qualification_slots, answers, "email") ||
      answers.email ||
      "",
    phone:
      reservedValue(config.qualification_slots, answers, "phone") ||
      answers.phone ||
      "",
  };
}

export async function promoteQualifiedLead(params: {
  tenantId: string;
  tenantName: string;
  leadTypeId: string;
  leadTypeName: string;
  config: LeadTypeConfig;
  answers: SlotAnswers;
  plan: string | null | undefined;
  unverified?: boolean;
}) {
  const contact = contactFromAnswers(params.config, params.answers);
  if (!params.unverified && (!contact.name || (!contact.email && !contact.phone))) {
    throw new Error("A name and a phone or email are required.");
  }
  if (
    (!params.plan || params.plan === "trial") &&
    contact.email &&
    isDisposableEmail(contact.email)
  ) {
    throw new Error("Use a regular email address.");
  }

  const supabase = getServiceClient("promote-qualified-lead");
  let duplicateQuery = supabase
    .from("statements")
    .select("id, qualification_answers")
    .eq("tenant_id", params.tenantId)
    .eq("participant_kind", "primary")
    .neq("lead_stage", "declined")
    .limit(1);

  if (contact.email) {
    duplicateQuery = duplicateQuery.ilike("contact_email", contact.email);
  } else if (contact.phone) {
    duplicateQuery = duplicateQuery.eq("contact_phone", contact.phone);
  }

  const { data: existing, error: existingError } = contact.email || contact.phone
    ? await duplicateQuery.maybeSingle()
    : { data: null, error: null };
  if (existingError) throw existingError;

  if (existing) {
    const previous =
      existing.qualification_answers &&
      typeof existing.qualification_answers === "object" &&
      !Array.isArray(existing.qualification_answers)
        ? existing.qualification_answers
        : {};
    const { error } = await supabase
      .from("statements")
      .update({
        qualification_answers: { ...previous, ...params.answers },
        contact_name: contact.name || null,
        contact_email: contact.email || null,
        contact_phone: contact.phone || null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return { statementId: existing.id, duplicate: true, caseId: null };
  }

  const role = primaryRole(params.config.participant_roles);
  const opened = await openTenantCase(
    params.tenantId,
    {
      title: contact.name
        ? `${contact.name} — ${params.leadTypeName}`
        : params.leadTypeName,
      case_template_id: params.leadTypeId,
      case_metadata: params.answers,
      status: "draft",
      contact_name: contact.name,
      contact_email: contact.email,
      contact_phone: contact.phone,
      lead_stage: "new",
      role_key: role?.key ?? "primary",
      accepted: false,
    },
    { bill: false },
  );
  if (!opened.ok) {
    throw new Error(opened.error);
  }

  const { data: primary, error: primaryError } = await supabase
    .from("statements")
    .select("id")
    .eq("case_id", opened.id)
    .eq("participant_kind", "primary")
    .maybeSingle();
  if (primaryError) throw primaryError;
  if (!primary) throw new Error("Lead could not be created.");

  return { statementId: primary.id, duplicate: false, caseId: opened.id };
}
