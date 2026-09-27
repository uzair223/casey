import type { CaseStatementJoin } from "@/types";

export const REDACTED_LEAD_NAME = "Lead";
export const REDACTED_CONTACT = "Hidden until accepted";

const CONTACT_METADATA_KEYS = new Set([
  "name",
  "email",
  "phone",
  "contact_name",
  "contact_email",
  "contact_phone",
  "witness_name",
  "witness_email",
  "awaiting_contact",
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{7,}\d)/g;

export function leadContactHidden(leadStage: string | null | undefined) {
  return leadStage === "new" || leadStage === "declined";
}

export function isContactMetadataKey(id: string) {
  return CONTACT_METADATA_KEYS.has(id);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function titleWithoutContact(
  title: string | null | undefined,
  name: string | null | undefined,
) {
  const current = title?.trim() ?? "";
  const person = name?.trim() ?? "";
  if (!current) return "Enquiry";
  if (person.length < 2) return current;
  const stripped = current
    .replace(new RegExp(`\\b${escapeRegExp(person)}\\b`, "gi"), "")
    .replace(/^[\s—–\-|]+|[\s—–\-|]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || "Enquiry";
}

function hiddenValues(contact: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return new Set(
    [contact.name, contact.email, contact.phone]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
}

export function redactMetadata(
  metadata: unknown,
  contact: { name?: string | null; email?: string | null; phone?: string | null },
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {} as Record<string, string>;
  }
  const hidden = hiddenValues(contact);
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string") continue;
    if (key === "summary") {
      const summary = value
        .replace(EMAIL_PATTERN, " ")
        .replace(PHONE_PATTERN, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (summary) next.summary = summary;
      continue;
    }
    if (CONTACT_METADATA_KEYS.has(key)) continue;
    if (hidden.has(value.trim().toLowerCase())) continue;
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim())) continue;
    next[key] = value;
  }
  return next;
}

export function redactAnswerMap(
  value: unknown,
  contact: { name?: string | null; email?: string | null; phone?: string | null },
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const hidden = hiddenValues(contact);
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (CONTACT_METADATA_KEYS.has(key)) continue;
    if (typeof entry === "string" && hidden.has(entry.trim().toLowerCase())) continue;
    if (key === "summary" && typeof entry === "string") {
      next[key] = entry
        .replace(EMAIL_PATTERN, " ")
        .replace(PHONE_PATTERN, " ")
        .replace(/\s+/g, " ")
        .trim();
      continue;
    }
    next[key] = entry;
  }
  return next;
}

type StatementContact = {
  participant_kind?: string | null;
  lead_stage?: string | null;
  witness_name?: string | null;
  witness_email?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  qualification_answers?: unknown;
};

function redactStatement<T extends StatementContact>(statement: T): T {
  if (!leadContactHidden(statement.lead_stage)) return statement;
  return {
    ...statement,
    witness_name: REDACTED_LEAD_NAME,
    witness_email: REDACTED_CONTACT,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    qualification_answers: redactAnswerMap(statement.qualification_answers, {
      name: statement.witness_name,
      email: statement.witness_email || statement.contact_email,
      phone: statement.contact_phone,
    }),
  };
}

export function redactCaseForFirm(caseItem: CaseStatementJoin): CaseStatementJoin {
  const primary =
    caseItem.statements.find((statement) => statement.participant_kind === "primary") ??
    caseItem.statements[0];
  if (!primary || !leadContactHidden(primary.lead_stage)) return caseItem;
  const stripped = titleWithoutContact(caseItem.title, primary.witness_name);
  const title =
    stripped === "Enquiry" && caseItem.case_template_name
      ? caseItem.case_template_name
      : stripped;
  return {
    ...caseItem,
    title,
    case_metadata: redactMetadata(caseItem.case_metadata, {
      name: primary.witness_name,
      email: primary.witness_email || primary.contact_email,
      phone: primary.contact_phone,
    }),
    statements: caseItem.statements.map((statement) => redactStatement(statement)),
  };
}

export function redactFirmStatementView<
  T extends {
    statement: StatementContact;
    case: { title?: string | null; case_metadata?: unknown };
  },
>(view: T): T {
  if (!leadContactHidden(view.statement.lead_stage)) return view;
  const contact = {
    name: view.statement.witness_name,
    email: view.statement.witness_email || view.statement.contact_email,
    phone: view.statement.contact_phone,
  };
  return {
    ...view,
    statement: redactStatement(view.statement),
    case: {
      ...view.case,
      title: titleWithoutContact(view.case.title, contact.name),
      case_metadata: redactMetadata(view.case.case_metadata, contact),
    },
  };
}
