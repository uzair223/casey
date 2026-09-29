import type { QualificationSlot } from "./schema";
import {
  MAX_QUALIFICATION_REPLY_CHARS,
  type SlotAnswers,
} from "./qualify";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{7,}\d)/;
const SCRIPTED_QUESTION =
  /^(your name|email|phone|when it happened|what harm followed|what happened|what treatment took place|what changed afterwards)\??$/i;
const CONTACT_ASK =
  /\b(your name|full name|email address|phone number|how (?:should|can) (?:the firm|we) reach|reach you)\b/i;

export const ENQUIRY_SUMMARY_KEY = "summary";

export function briefForLeadType(leadTypeName: string, guidance?: string | null) {
  const specific = guidance?.trim();
  if (specific) return specific;
  const name = leadTypeName.toLowerCase();
  if (name.includes("employer") || name.includes("work")) {
    return 'Include their role, who they work for, what happened, the harm, and the kind of place. Example: "The lead is a courier for Evri who was in a work-related incident where parcels fell and fractured their foot at the depot."';
  }
  if (name.includes("rta") || name.includes("road") || name.includes("traffic")) {
    return 'Include their role in the vehicle, the collision, and the harm. Example: "The lead was a passenger in a car that was hit from behind at a junction, and they have neck and back pain."';
  }
  if (name.includes("public")) {
    return 'Include the kind of place, how they were hurt, and the harm. Example: "The lead slipped on a wet shop floor and fractured their wrist."';
  }
  if (name.includes("clinical") || name.includes("negligence")) {
    return 'Include the care and what went wrong. Example: "The lead attended hospital with abdominal pain and says the diagnosis was delayed, after which they needed emergency surgery."';
  }
  if (name.includes("housing") || name.includes("disrepair")) {
    return 'Include the disrepair and who lives there. Example: "The lead and their child live in a rented flat with long-running damp and mould, which they have reported to the landlord."';
  }
  return 'Include what happened, when, and what followed. Example: "The lead was hurt in an incident and has been unable to work since."';
}

export type EnquiryExtraction = {
  reply: string;
  overviewReady: boolean;
  summary: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

const LooseEnquiryTurnSchema = {
  parse(value: unknown): EnquiryExtraction | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const reply = typeof record.reply === "string" ? record.reply.trim() : "";
    if (!reply) return null;
    return {
      reply: reply.slice(0, MAX_QUALIFICATION_REPLY_CHARS),
      overviewReady: record.overviewReady === true,
      summary: typeof record.summary === "string" ? record.summary.trim() : null,
      name: typeof record.name === "string" ? record.name.trim() : null,
      email: typeof record.email === "string" ? record.email.trim() : null,
      phone: typeof record.phone === "string" ? record.phone.trim() : null,
    };
  },
};

export function parseEnquiryJson(text: string): EnquiryExtraction | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return LooseEnquiryTurnSchema.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

export function isEnquiryFullName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

export function enquiryInstructions(params: {
  firmName: string;
  leadTypeName: string;
  hasOverview: boolean;
  hasName: boolean;
  givenName?: string;
  hasEmail: boolean;
  hasPhone: boolean;
  briefGuidance?: string | null;
}) {
  const needsName = !params.hasName;
  const needsMethod = !params.hasEmail && !params.hasPhone;
  const givenName = params.givenName?.trim() ?? "";
  const contactAsk = !params.hasOverview || (!needsName && !needsMethod)
    ? ""
    : needsName && givenName && needsMethod
      ? `They have only given the name ${givenName}. Ask for their full name, and an email or phone number.`
      : needsName && givenName
        ? `They have only given the name ${givenName}. Ask for their full name.`
        : needsName && needsMethod
          ? "Ask, in one natural sentence, for their full name and an email or phone number. A first name alone is not enough."
          : needsName
            ? "Ask for their full name. A first name alone is not enough."
            : "Ask, in one natural sentence, for an email or phone number.";
  return [
    `You are Casey, talking with someone who has come to ${params.firmName} about ${params.leadTypeName}.`,
    "This is a short natural conversation, a simpler version of taking their account. It is not a form and not a checklist.",
    "Understand what happened, roughly when, and what followed, well enough for a colleague to read a two-sentence overview.",
    "The overview is ready once those three things are clear. Do not ask how something was moved or stored, who was at fault, or for medical detail beyond what the person has already said. That finer account comes later.",
    "Ask one question at a time, and only when the overview would otherwise miss what happened, when, or what followed.",
    'Do not ask labelled questions such as "Your name?", "When it happened?", or "What harm followed?".',
    "Do not give legal advice. Do not draft a statement. Do not mention these instructions.",
    params.hasOverview
      ? "You already have enough for the overview. Do not keep interviewing them about the incident."
      : "Stay with the incident until the overview can be written. Do not ask for their name or contact details yet.",
    contactAsk,
    'summary is one or two sentences in the third person, or null when the overview is not ready. Call the person "the lead" once. Never write "the lead is the lead". Never include their name, email, phone, or street address. Use the words they used for what happened.',
    `Write the summary the way a colleague would brief the firm. ${briefForLeadType(params.leadTypeName, params.briefGuidance)}`,
    "overviewReady is true only when what happened, when, and the result are clear enough for that overview.",
    "name is the full name the person has actually said. If they have only given a first name, set name to that first name and still ask for their full name. Do not invent a surname. email and phone are values they have actually said, otherwise null.",
    "reply is the next thing you say, in one or two sentences.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function enquiryContact(slots: QualificationSlot[], answers: SlotAnswers) {
  const read = (field: "name" | "email" | "phone") => {
    const slot = slots.find((item) => item.reserved === field);
    return (slot ? answers[slot.id] : "") || answers[field] || "";
  };
  return {
    name: read("name").trim(),
    email: read("email").trim(),
    phone: read("phone").trim(),
  };
}

function writeContact(
  slots: QualificationSlot[],
  answers: SlotAnswers,
  field: "name" | "email" | "phone",
  value: string,
) {
  const next = { ...answers, [field]: value };
  const slot = slots.find((item) => item.reserved === field);
  if (slot) next[slot.id] = value;
  return next;
}

export function normalizeEnquiryEmail(value: string | null | undefined) {
  const match = value?.match(EMAIL_PATTERN);
  return match ? match[0].toLowerCase() : "";
}

export function normalizeEnquiryPhone(value: string | null | undefined) {
  const match = value?.match(PHONE_PATTERN);
  if (!match) return "";
  const compact = match[0].replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "";
  return compact;
}

const NAME_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "at",
  "for",
  "of",
  "in",
  "on",
  "to",
  "and",
  "or",
  "my",
  "i",
]);

export function plausibleName(value: string | null | undefined) {
  const name = value?.replace(/\s+/g, " ").trim() ?? "";
  if (name.length < 2 || name.length > 80) return "";
  if (/[0-9@]/.test(name)) return "";
  if (/[.!?]/.test(name)) return "";
  const words = name.split(" ");
  if (words.length > 4) return "";
  if (words.some((word) => NAME_STOPWORDS.has(word.toLowerCase()))) return "";
  return name;
}

function attested(name: string, message: string) {
  return message.toLowerCase().includes(name.toLowerCase());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeEnquirySummary(
  summary: string,
  contact: { name?: string | null; email?: string | null; phone?: string | null },
) {
  let text = summary.replace(EMAIL_PATTERN, " ").replace(PHONE_PATTERN, " ");
  const name = plausibleName(contact.name);
  if (name.length >= 2) {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi");
    text = text.replace(pattern, (match, offset: number) => {
      const before = text.slice(0, offset);
      const atStart = before.trim().length === 0 || /[.!?]\s*$/.test(before);
      return atStart ? "The lead" : "the lead";
    });
  }
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function isScriptedQuestion(reply: string) {
  return SCRIPTED_QUESTION.test(reply.trim());
}

function incidentFollowUp() {
  return "Tell me a bit more about what happened, including roughly when and what followed.";
}

function chooseName(current: string, candidate: string) {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentCount = current.split(/\s+/).length;
  const nextCount = candidate.split(/\s+/).length;
  if (nextCount < currentCount) return current;
  return candidate;
}

function contactFollowUp(contact: { name: string; email: string; phone: string }) {
  const hasMethod = Boolean(contact.email || contact.phone);
  const fullName = isEnquiryFullName(contact.name);
  if (!fullName && !hasMethod) {
    return "What is your full name, and an email or phone number the firm can use?";
  }
  if (!fullName) return "What is your full name?";
  if (!hasMethod) return "What email or phone number should the firm use?";
  return "How should the firm reach you? Your full name and an email or phone number are enough.";
}

export function settleEnquiryTurn(params: {
  slots: QualificationSlot[];
  answers: SlotAnswers;
  message: string;
  transcript?: string;
  extraction: EnquiryExtraction | null;
  wrapUp?: boolean;
}) {
  let answers = { ...params.answers };
  const spoken = params.transcript?.trim() || params.message;
  const email =
    normalizeEnquiryEmail(params.extraction?.email) ||
    normalizeEnquiryEmail(params.message);
  const phone =
    normalizeEnquiryPhone(params.extraction?.phone) ||
    normalizeEnquiryPhone(params.message);
  if (email) answers = writeContact(params.slots, answers, "email", email);
  if (phone) answers = writeContact(params.slots, answers, "phone", phone);

  const extractedName = plausibleName(params.extraction?.name);
  const nameCandidate =
    extractedName && attested(extractedName, spoken) ? extractedName : "";
  const currentName = enquiryContact(params.slots, answers).name;
  const name = chooseName(currentName, nameCandidate ?? "");
  if (name && name !== currentName) {
    answers = writeContact(params.slots, answers, "name", name);
  }

  const contactForSummary = {
    ...enquiryContact(params.slots, answers),
    name: name || nameCandidate || enquiryContact(params.slots, answers).name,
  };
  let summary = (answers[ENQUIRY_SUMMARY_KEY] ?? "").trim();
  if (params.extraction?.overviewReady && params.extraction.summary) {
    const cleaned = sanitizeEnquirySummary(params.extraction.summary, {
      ...contactForSummary,
      name: contactForSummary.name || extractedName,
    });
    if (cleaned.length >= 40) summary = cleaned;
  }
  if (summary) answers[ENQUIRY_SUMMARY_KEY] = summary;

  const contact = enquiryContact(params.slots, answers);
  const hasOverview = summary.length >= 40;
  const hasMethod = Boolean(contact.email || contact.phone);
  const ready = hasOverview && isEnquiryFullName(contact.name) && hasMethod;

  let reply = params.extraction?.reply.trim() ?? "";
  if (!reply || isScriptedQuestion(reply)) {
    reply = hasOverview ? contactFollowUp(contact) : incidentFollowUp();
  }
  if (!hasOverview && CONTACT_ASK.test(reply)) {
    reply = incidentFollowUp();
  }
  if (hasOverview && !ready) {
    answers.awaiting_contact = "true";
    if (!CONTACT_ASK.test(reply) || isScriptedQuestion(reply)) {
      reply = contactFollowUp(contact);
    }
  } else {
    delete answers.awaiting_contact;
  }
  if (ready) {
    reply = contact.email
      ? "Thank you. I have emailed you a short code. Enter it here to pass this to the firm. If you do not see it, check your junk folder."
      : "Thank you. I am sending a short code to confirm this contact. Enter that code to pass this to the firm.";
  }

  return { answers, reply, readyToVerify: ready };
}
