import type { QualificationSlot } from "./schema";

export type SlotAnswers = Record<string, string>;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d[\d\s()-]{7,}\d)/;
const REFUSAL_PATTERNS = [
  /ignore (all|any|previous|prior) instructions/i,
  /you are now/i,
  /system prompt/i,
  /reveal your (instructions|prompt)/i,
];

export const MAX_QUALIFICATION_TURNS = 15;
export const MAX_QUALIFICATION_MESSAGE_CHARS = 2000;
export const MAX_QUALIFICATION_REPLY_CHARS = 800;
export const MAX_REFUSALS = 3;

export function reservedValue(
  slots: QualificationSlot[],
  answers: SlotAnswers,
  reserved: "name" | "email" | "phone",
) {
  const slot = slots.find((item) => item.reserved === reserved);
  if (!slot) return "";
  return (answers[slot.id] ?? "").trim();
}

export function missingRequiredSlots(
  slots: QualificationSlot[],
  answers: SlotAnswers,
) {
  return slots.filter((slot) => {
    if (!slot.required) return false;
    return !(answers[slot.id] ?? "").trim();
  });
}

export function hasContact(
  slots: QualificationSlot[],
  answers: SlotAnswers,
) {
  const name = reservedValue(slots, answers, "name");
  const email = reservedValue(slots, answers, "email");
  const phone = reservedValue(slots, answers, "phone");
  return Boolean(name && (email || phone));
}

export function readyToVerify(
  slots: QualificationSlot[],
  answers: SlotAnswers,
) {
  return (
    missingRequiredSlots(slots, answers).length === 0 &&
    hasContact(slots, answers)
  );
}

export function nextPendingSlot(
  slots: QualificationSlot[],
  answers: SlotAnswers,
) {
  const required = missingRequiredSlots(slots, answers)[0];
  if (required) return required;
  if (!hasContact(slots, answers)) {
    const email = slots.find((slot) => slot.reserved === "email");
    const phone = slots.find((slot) => slot.reserved === "phone");
    if (email && !reservedValue(slots, answers, "email")) return email;
    if (phone && !reservedValue(slots, answers, "phone")) return phone;
  }
  return null;
}

export function refusalReason(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return null;
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "Attempted to override the qualification instructions.";
    }
  }
  return null;
}

export function interpretAnswer(slot: QualificationSlot, message: string) {
  const trimmed = message.trim().slice(0, MAX_QUALIFICATION_MESSAGE_CHARS);
  if (!trimmed) return null;

  if (slot.reserved === "email") {
    const match = trimmed.match(EMAIL_PATTERN);
    return match ? match[0].toLowerCase() : null;
  }

  if (slot.reserved === "phone") {
    const match = trimmed.match(PHONE_PATTERN);
    if (!match) return null;
    return match[0].replace(/[^\d+]/g, "");
  }

  if (slot.type === "boolean") {
    if (/^(yes|y|true)$/i.test(trimmed)) return "yes";
    if (/^(no|n|false)$/i.test(trimmed)) return "no";
    return null;
  }

  if (slot.type === "select") {
    const match = (slot.options ?? []).find(
      (option) => option.toLowerCase() === trimmed.toLowerCase(),
    );
    return match ?? null;
  }

  if (slot.type === "number") {
    const match = trimmed.match(/-?\d+(\.\d+)?/);
    return match ? match[0] : null;
  }

  if (slot.type === "long_text" && trimmed.length < 8) return null;
  if (slot.type === "text" && trimmed.length < 2 && slot.reserved !== "name") {
    return null;
  }
  if (slot.reserved === "name" && trimmed.length < 2) return null;

  return trimmed;
}

export function questionFor(slot: QualificationSlot) {
  if (slot.reserved === "email") {
    return "What email address should the firm use?";
  }
  if (slot.reserved === "phone") {
    return "What phone number should the firm use?";
  }
  return slot.label.endsWith("?") ? slot.label : `${slot.label}?`;
}

export function slotForOpeningMessage(
  slots: QualificationSlot[],
  pendingSlotId: string | null,
  message: string,
) {
  const narrative = slots.find(
    (slot) => slot.required && slot.type === "long_text" && !slot.reserved,
  );
  if (!narrative || narrative.id === pendingSlotId) return pendingSlotId;
  if (!interpretAnswer(narrative, message)) return pendingSlotId;
  return narrative.id;
}

export function openingMessage(slot: QualificationSlot | null) {
  if (!slot) {
    return "Tell me how to reach you and what happened.";
  }
  return `Hello, I am Casey. ${questionFor(slot)}`;
}

export function applyTurn(params: {
  slots: QualificationSlot[];
  answers: SlotAnswers;
  pendingSlotId: string | null;
  message: string;
}) {
  const refusal = refusalReason(params.message);
  if (refusal) {
    return {
      answers: params.answers,
      pendingSlotId: params.pendingSlotId,
      reply: "I can only take the details this enquiry needs.",
      refusal,
      filled: false,
    };
  }

  const pending =
    params.slots.find((slot) => slot.id === params.pendingSlotId) ??
    nextPendingSlot(params.slots, params.answers);

  if (!pending) {
    return {
      answers: params.answers,
      pendingSlotId: null,
      reply: reservedValue(params.slots, params.answers, "email")
        ? "I have what I need. I have emailed you a short code. Enter it here, and check your junk folder if you do not see it."
        : "I have what I need. Enter the code that was just sent to you.",
      refusal: null,
      filled: false,
    };
  }

  const value = interpretAnswer(pending, params.message);
  if (!value) {
    return {
      answers: params.answers,
      pendingSlotId: pending.id,
      reply: `I still need a clear answer. ${questionFor(pending)}`,
      refusal: null,
      filled: false,
    };
  }

  const answers = { ...params.answers, [pending.id]: value };
  const next = nextPendingSlot(params.slots, answers);
  if (!next && readyToVerify(params.slots, answers)) {
    return {
      answers,
      pendingSlotId: null,
      reply: reservedValue(params.slots, answers, "email")
        ? "Thank you. I have emailed you a short code. Enter it here to pass this to the firm. If you do not see it, check your junk folder."
        : "Thank you. I am sending a short code to confirm this contact. Enter that code to pass this to the firm.",
      refusal: null,
      filled: true,
    };
  }

  return {
    answers,
    pendingSlotId: next?.id ?? null,
    reply: next
      ? questionFor(next)
      : "I still need a phone number or email address.",
    refusal: null,
    filled: true,
  };
}

export function outreachSummary(
  slots: QualificationSlot[],
  answers: SlotAnswers,
) {
  return slots
    .filter((slot) => slot.include_in_outreach)
    .map((slot) => (answers[slot.id] ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function renderOutreachTemplate(params: {
  template: string;
  role: string;
  firm: string;
  summary: string;
}) {
  return params.template
    .replaceAll("{role}", params.role)
    .replaceAll("{firm}", params.firm)
    .replaceAll("{summary}", params.summary || "an incident")
    .replace(/\s+/g, " ")
    .trim();
}

const OUTREACH_LEAK =
  /\bthe lead\b|\binjur|\btreatment\b|\bhospital\b|time off/i;

export function supportingOutreachFallback(params: {
  witnessName: string;
  clientName: string;
  role: string;
  firm: string;
}) {
  const witness = params.witnessName.trim();
  const client = params.clientName.trim();
  const role = params.role.trim().toLowerCase() || "colleague";
  const firm = params.firm.trim() || "the firm";
  const hello = witness ? `Hello ${witness}` : "Hello";
  const named = client
    ? `${client} named you as a ${role} regarding an incident that occurred.`
    : `you were named as a ${role} regarding an incident that occurred.`;
  return `${hello}, ${named} ${firm} is asking for your account.`;
}

export function acceptableOutreachNote(draft: string) {
  const text = draft.replace(/\s+/g, " ").trim();
  if (!text || text.length > 500) return false;
  return !OUTREACH_LEAK.test(text);
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "yopmail.com",
  "10minutemail.com",
]);

export function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export type SupportingPersonProposal = {
  roleKey: string;
  name: string;
  email: string;
  phone: string;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function contactAppearsInTranscript(value: string, transcript: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const haystack = transcript.toLowerCase();
  if (haystack.includes(trimmed.toLowerCase())) return true;
  const digits = digitsOnly(trimmed);
  return digits.length >= 7 && digitsOnly(transcript).includes(digits);
}

export function parseSupportingPeople(params: {
  raw: string;
  transcript: string;
  roleKeys: string[];
  claimantEmail?: string | null;
}): SupportingPersonProposal[] {
  const cleaned = params.raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const rows =
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "people" in parsed &&
    Array.isArray(parsed.people)
      ? parsed.people
      : [];
  const fallbackRole = params.roleKeys[0] ?? "witness";
  const claimantEmail = params.claimantEmail?.trim().toLowerCase() ?? "";
  const seen = new Set<string>();
  const people: SupportingPersonProposal[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as {
      name?: unknown;
      roleKey?: unknown;
      email?: unknown;
      phone?: unknown;
    };
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (name.length < 2) continue;
    const email =
      typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    const phone = typeof record.phone === "string" ? record.phone.trim() : "";
    if (email && email === claimantEmail) continue;
    if (!contactAppearsInTranscript(email, params.transcript)) continue;
    if (!contactAppearsInTranscript(phone, params.transcript)) continue;
    const requestedRole =
      typeof record.roleKey === "string" ? record.roleKey.trim() : "";
    const roleKey = params.roleKeys.includes(requestedRole)
      ? requestedRole
      : fallbackRole;
    const key = email || name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({ roleKey, name, email, phone });
  }

  return people;
}
