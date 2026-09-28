import "server-only";

import { openTenantCase } from "@/lib/billing/open-case";
import { parseCaseConfig } from "@/lib/llm/case-runtime";
import { getServiceClient } from "@/lib/supabase/server";
import {
  leadFactsFromEnquiry,
  mergeCaseFacts,
  type EnquiryMessage,
} from "./case-facts";
import { isDisposableEmail, reservedValue, type SlotAnswers } from "./qualify";
import { leadListTitle } from "./privacy";
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
  messages?: EnquiryMessage[];
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

  const summary = (params.answers.summary ?? "").trim();
  const messages = params.messages ?? [];
  const supabase = getServiceClient("promote-qualified-lead");
  const { data: templateRow, error: templateError } = await supabase
    .from("case_templates")
    .select("published_config")
    .eq("id", params.leadTypeId)
    .maybeSingle();
  if (templateError) throw templateError;
  const facts = leadFactsFromEnquiry({
    fields: parseCaseConfig(templateRow?.published_config)?.dynamicFields ?? [],
    name: contact.name,
    summary,
    messages,
  });
  const metadata = {
    ...(summary ? { summary } : {}),
    ...facts,
  };
  const qualificationAnswers = {
    ...metadata,
    ...(messages.length ? { enquiry_transcript: messages } : {}),
  };
  let duplicateQuery = supabase
    .from("statements")
    .select("id, case_id, qualification_answers")
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
        qualification_answers: {
          ...previous,
          ...qualificationAnswers,
        },
        contact_name: contact.name || null,
        contact_email: contact.email || null,
        contact_phone: contact.phone || null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    if (existing.case_id && (summary || Object.keys(facts).length)) {
      const { data: caseRow, error: caseError } = await supabase
        .from("cases")
        .select("case_metadata")
        .eq("id", existing.case_id)
        .maybeSingle();
      if (caseError) throw caseError;
      const previousMetadata =
        caseRow?.case_metadata &&
        typeof caseRow.case_metadata === "object" &&
        !Array.isArray(caseRow.case_metadata)
          ? caseRow.case_metadata
          : {};
      const merged = {
        ...previousMetadata,
        ...mergeCaseFacts(previousMetadata as Record<string, string>, facts),
      };
      if (summary) merged.summary = summary;
      const { error: metadataError } = await supabase
        .from("cases")
        .update({ case_metadata: merged })
        .eq("id", existing.case_id);
      if (metadataError) throw metadataError;
    }
    return { statementId: existing.id, duplicate: true, caseId: existing.case_id };
  }

  const role = primaryRole(params.config.participant_roles);
  const opened = await openTenantCase(
    params.tenantId,
    {
      title: leadListTitle(contact.name, params.leadTypeName),
      case_template_id: params.leadTypeId,
      case_metadata: metadata,
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

  if (messages.length) {
    const { error: answersError } = await supabase
      .from("statements")
      .update({ qualification_answers: qualificationAnswers })
      .eq("id", primary.id);
    if (answersError) throw answersError;
  }

  return { statementId: primary.id, duplicate: false, caseId: opened.id };
}
