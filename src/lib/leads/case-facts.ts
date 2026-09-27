import type { CaseFact } from "@/lib/llm/case-runtime";

export const RETIRED_CASE_FIELD_IDS = new Set(["court", "claimNumber"]);

export function activeCaseFieldIds(ids: readonly string[] | null | undefined) {
  return (ids ?? []).filter((id) => !RETIRED_CASE_FIELD_IDS.has(id));
}

export type EnquiryMessage = {
  role: "user" | "assistant";
  content: string;
};

type LeadField = {
  id: string;
  label: string;
  type?: "text" | "number" | "date";
};

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

const SPOKEN_DATE = new RegExp(
  `\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS})|(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?:\\s*,?\\s*((?:19|20)\\d{2}))?\\b`,
  "i",
);

const ISO_DATE = /\b((?:19|20)\d{2}-\d{2}-\d{2})\b/;

export function readEnquirySummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : null;
}

export function readEnquiryTranscript(value: unknown): EnquiryMessage[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as { enquiry_transcript?: unknown }).enquiry_transcript;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as { role?: unknown; content?: unknown };
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      !message.content.trim()
    ) {
      return [];
    }
    return [{ role: message.role, content: message.content.trim() }];
  });
}

export function formatEnquiryTranscript(messages: EnquiryMessage[]) {
  const lines = messages.map(
    (message) =>
      `${message.role === "user" ? "Person" : "Casey"}: ${message.content.trim()}`,
  );
  const text = lines.join("\n").trim();
  if (text.length <= 4000) return text;
  return text.slice(text.length - 4000);
}

export function spokenDateIn(text: string) {
  const iso = text.match(ISO_DATE);
  if (iso?.[1]) return iso[1];
  const spoken = text.match(SPOKEN_DATE);
  if (!spoken) return null;
  return spoken[0].replace(/\s+/g, " ").trim();
}

function enquiryText(summary: string, messages: EnquiryMessage[]) {
  const spoken = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
  return [summary.trim(), spoken].filter(Boolean).join("\n");
}

function isPersonName(value: string) {
  const name = value.trim();
  if (name.length < 2) return false;
  if (/^(lead|pending)$/i.test(name)) return false;
  return true;
}

const WORKPLACE_IN_TEXT =
  /\b(?:at|in) the ([A-Z][A-Za-z0-9&'’.-]*(?:\s+[A-Z][A-Za-z0-9&'’.-]*){0,5}\s+depot)\b/;
const EMPLOYER_IN_TEXT =
  /\b(?:courier at|work(?:ing)? (?:for|at)|employed by|my employer is)\s+([A-Z][A-Za-z0-9&'’.-]*)\b/;

export function statedCaseDetails(text: string, fieldIds: readonly string[]) {
  const allowed = new Set(fieldIds);
  const facts: Record<string, string> = {};
  if (allowed.has("workplace")) {
    const workplace = text.match(WORKPLACE_IN_TEXT)?.[1]?.replace(/\s+/g, " ").trim();
    if (workplace) facts.workplace = workplace;
  }
  if (allowed.has("defendant")) {
    const employer = text.match(EMPLOYER_IN_TEXT)?.[1]?.trim();
    if (employer) facts.defendant = employer;
  }
  return facts;
}

export function leadFactsFromEnquiry(params: {
  fields: LeadField[];
  name: string;
  summary?: string | null;
  messages?: EnquiryMessage[];
}) {
  const facts: Record<string, string> = {};
  const name = params.name.trim();
  const text = enquiryText(params.summary ?? "", params.messages ?? []);
  const date = text ? spokenDateIn(text) : null;
  let dateUsed = false;
  Object.assign(
    facts,
    statedCaseDetails(
      text,
      params.fields.map((field) => field.id),
    ),
  );

  for (const field of params.fields) {
    if (
      (field.id === "claimant" || field.label.trim().toLowerCase() === "claimant") &&
      isPersonName(name)
    ) {
      facts[field.id] = name;
      continue;
    }
    if (field.type === "date" && date && !dateUsed) {
      facts[field.id] = date;
      dateUsed = true;
    }
  }

  return facts;
}

function hasYear(value: string) {
  return /\b(?:19|20)\d{2}\b/.test(value);
}

function hasTime(value: string) {
  return /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening|night|o'clock)\b/i.test(
    value,
  );
}

function sameSpokenDay(current: string, incoming: string) {
  const left = spokenDateIn(current);
  const right = spokenDateIn(incoming);
  if (!left || !right) return false;
  const leftDay = left.match(SPOKEN_DATE);
  const rightDay = right.match(SPOKEN_DATE);
  if (!leftDay || !rightDay) return left === right;
  const leftNumber = leftDay[1] || leftDay[4];
  const rightNumber = rightDay[1] || rightDay[4];
  const leftMonth = (leftDay[2] || leftDay[3] || "").toLowerCase();
  const rightMonth = (rightDay[2] || rightDay[3] || "").toLowerCase();
  return leftNumber === rightNumber && leftMonth.slice(0, 3) === rightMonth.slice(0, 3);
}

export function isClearerCaseFact(
  current: string | null | undefined,
  incoming: string | null | undefined,
) {
  const next = incoming?.trim() ?? "";
  const previous = current?.trim() ?? "";
  if (!next) return false;
  if (!previous) return true;
  if (next.toLowerCase() === previous.toLowerCase()) return false;
  if (
    next.toLowerCase().includes(previous.toLowerCase()) &&
    next.length > previous.length
  ) {
    return true;
  }
  if (!sameSpokenDay(previous, next)) return false;
  const yearAdded = hasYear(next) && !hasYear(previous);
  const timeAdded = hasTime(next) && !hasTime(previous);
  return yearAdded || timeAdded;
}

export function mergeCaseFacts(
  current: Record<string, string | null | undefined>,
  incoming: Record<string, string | null | undefined>,
) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string" && value.trim()) next[key] = value;
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "summary" || key === "enquiry_transcript") continue;
    if (!isClearerCaseFact(next[key], value)) continue;
    next[key] = value!.trim();
  }
  return next;
}

export function accountGaps(facts: CaseFact[]) {
  const gaps: string[] = [];
  for (const fact of facts) {
    const label = fact.label.trim().toLowerCase();
    const phrase = label.startsWith("the ") ? label : `the ${label}`;
    if (!fact.value) {
      gaps.push(phrase);
      continue;
    }
    if (fact.id === "claimant" && fact.value.trim().split(/\s+/).length < 2) {
      gaps.push("your full name");
    }
    if (fact.type !== "date") continue;
    const year = hasYear(fact.value);
    const time = hasTime(fact.value);
    if (!year && !time) gaps.push("the year and the time of day");
    else if (!year) gaps.push("the year");
    else if (!time) gaps.push("the time of day");
  }
  return gaps;
}

export function questionForAccountGaps(gaps: string[]) {
  if (!gaps.length) return null;
  const list =
    gaps.length === 1
      ? gaps[0]
      : `${gaps.slice(0, -1).join(", ")} and ${gaps.at(-1)}`;
  return `Could you tell me ${list}?`;
}
