import { choice, noul, type Questions } from "./questions";
import { evaluateWithJev } from "./client";
import {
  JEV_CHOICE_CONFIDENCE_MIN,
  JEV_ENQUIRY_TYPE_CONFIDENCE_MIN,
  JEV_NOUL_AGREE_MIN,
  JEV_NOUL_STOP_MIN,
  JEV_TRANSCRIPT_TURNS,
  JEV_TURN_TEXT_MAX_CHARS,
} from "./thresholds";

export type EnquiryLeadTypeOption = {
  id: string;
  name: string;
  channelId: string;
};

export type EnquiryDecision = {
  usedJev: boolean;
  action: "continue" | "end";
  disposition: "send_to_firm" | "discard";
  discardNow: boolean;
  redirect: EnquiryLeadTypeOption | null;
};

const REDIRECT_LEAD_TYPE_ID = "redirect_lead_type_id";
const REDIRECT_CHANNEL_ID = "redirect_channel_id";
const REDIRECT_DECLINED_IDS = "redirect_declined_ids";

export const ENQUIRY_DISCARD_REPLY =
  "This will not be passed to the firm.";

type ChoiceAnswer = { choice: string; confidence: number };
type NoulAnswer = { noul: number };
type SlotAnswers = Record<string, string>;

function truncateText(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= JEV_TURN_TEXT_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, JEV_TURN_TEXT_MAX_CHARS)}...[truncated]`;
}

function asChoiceAnswer(value: unknown): ChoiceAnswer | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { choice?: unknown; confidence?: unknown };
  if (typeof record.choice !== "string" || record.choice.length === 0) return null;
  return {
    choice: record.choice,
    confidence:
      typeof record.confidence === "number" && Number.isFinite(record.confidence)
        ? record.confidence
        : 0,
  };
}

function asNoulAnswer(value: unknown): NoulAnswer | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { noul?: unknown };
  if (typeof record.noul !== "number" || !Number.isFinite(record.noul)) return null;
  return { noul: record.noul };
}

export function continuingEnquiryDecision(): EnquiryDecision {
  return {
    usedJev: false,
    action: "continue",
    disposition: "send_to_firm",
    discardNow: false,
    redirect: null,
  };
}

export function enquiryClosesWithoutLead(decision: EnquiryDecision) {
  if (!decision.usedJev) return false;
  if (decision.discardNow) return true;
  return (
    decision.action === "end" &&
    decision.disposition === "discard" &&
    decision.redirect === null
  );
}

export function buildEnquiryQuestions(leadTypes: EnquiryLeadTypeOption[]) {
  const questions: Questions = {
    conversationAction: choice("Should this enquiry conversation continue or end?", {
      continue:
        "The person is still giving a genuine account and it is too early to close.",
      end: "There is enough to stop, or the conversation should not continue.",
    }),
    disposition: choice(
      "If the conversation ends, should it be sent to the firm or discarded?",
      {
        send_to_firm: "This is a genuine matter the firm should receive as a lead.",
        discard:
          "Spam, abuse, a jailbreak, or not something this firm should receive.",
      },
    ),
    shouldDiscardNow: noul(
      "Should this enquiry stop immediately because the turn is abusive, a jailbreak, or not an enquiry?",
      {
        true: "Continuing would be unsafe, abusive, or clearly against taking an enquiry.",
        false: "The conversation can continue, or it can be sent to the firm.",
      },
    ),
  };

  if (leadTypes.length > 1) {
    questions.matchedLeadType = choice(
      "Which enabled enquiry type best matches what the person is describing? Choose the selected type when it still fits.",
      Object.fromEntries(leadTypes.map((type) => [type.id, type.name])),
    );
  }

  return questions;
}

export function buildEnquiryState(params: {
  currentLeadTypeId: string;
  currentLeadTypeName: string;
  leadTypes: EnquiryLeadTypeOption[];
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  latestUserMessage: string;
}) {
  return {
    selectedLeadType: {
      id: params.currentLeadTypeId,
      name: params.currentLeadTypeName,
    },
    enabledLeadTypes: params.leadTypes.map((type) => ({
      id: type.id,
      name: type.name,
    })),
    recentTranscript: params.messages.slice(-JEV_TRANSCRIPT_TURNS).map((message) => ({
      role: message.role,
      content: truncateText(message.content),
    })),
    latestUserMessage: truncateText(params.latestUserMessage),
  };
}

export function mergeEnquiryDecisions(params: {
  answers: Record<string, unknown> | null;
  currentLeadTypeId: string;
  leadTypes: EnquiryLeadTypeOption[];
  declinedLeadTypeIds: string[];
}): EnquiryDecision {
  if (!params.answers) return continuingEnquiryDecision();

  const actionAnswer = asChoiceAnswer(params.answers.conversationAction);
  const dispositionAnswer = asChoiceAnswer(params.answers.disposition);
  const discardAnswer = asNoulAnswer(params.answers.shouldDiscardNow);
  const typeAnswer = asChoiceAnswer(params.answers.matchedLeadType);
  const enabled = new Map(params.leadTypes.map((type) => [type.id, type]));
  const declined = new Set(params.declinedLeadTypeIds);

  const action =
    actionAnswer &&
    actionAnswer.confidence >= JEV_CHOICE_CONFIDENCE_MIN &&
    (actionAnswer.choice === "continue" || actionAnswer.choice === "end")
      ? actionAnswer.choice
      : "continue";
  const disposition =
    dispositionAnswer &&
    dispositionAnswer.confidence >= JEV_CHOICE_CONFIDENCE_MIN &&
    (dispositionAnswer.choice === "send_to_firm" ||
      dispositionAnswer.choice === "discard")
      ? dispositionAnswer.choice
      : "send_to_firm";
  const discardNow = (discardAnswer?.noul ?? 0) >= JEV_NOUL_STOP_MIN;

  const matched =
    typeAnswer &&
    typeAnswer.confidence >= JEV_ENQUIRY_TYPE_CONFIDENCE_MIN
      ? enabled.get(typeAnswer.choice) ?? null
      : null;
  const redirect =
    !discardNow &&
    matched &&
    matched.id !== params.currentLeadTypeId &&
    !declined.has(matched.id)
      ? matched
      : null;

  if (discardNow) {
    return {
      usedJev: true,
      action: "end",
      disposition: "discard",
      discardNow: true,
      redirect: null,
    };
  }

  return {
    usedJev: true,
    action,
    disposition,
    discardNow: false,
    redirect,
  };
}

export function interpretRedirectAnswer(message: string): "yes" | "no" | "unclear" {
  const text = message
    .trim()
    .toLowerCase()
    .replace(/[.!]+$/g, "")
    .replace(/\s+/g, " ");
  if (
    /^(y|yes|yeah|yep|yup|sure|ok|okay|please|please do|go ahead|that's right|that is right|correct|switch)$/.test(
      text,
    )
  ) {
    return "yes";
  }
  if (/^(n|no|nope|nah|don't|do not|stay|keep it|no thanks|no thank you)$/.test(text)) {
    return "no";
  }
  return "unclear";
}

export function silentLeadTypeRoute(
  decision: EnquiryDecision,
  leadTypes: EnquiryLeadTypeOption[],
) {
  if (!decision.redirect) return null;
  return leadTypes.find((type) => type.id === decision.redirect?.id) ?? null;
}

export function redirectQuestion(currentName: string, nextName: string) {
  return `This sounds like ${nextName} rather than ${currentName}. Should I continue it as ${nextName}?`;
}

export function declinedLeadTypeIds(answers: SlotAnswers) {
  return (answers[REDIRECT_DECLINED_IDS] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function redirectOfferFrom(answers: SlotAnswers) {
  const leadTypeId = answers[REDIRECT_LEAD_TYPE_ID]?.trim() ?? "";
  const channelId = answers[REDIRECT_CHANNEL_ID]?.trim() ?? "";
  if (!leadTypeId || !channelId) return null;
  return { leadTypeId, channelId };
}

export function clearRedirectOffer(answers: SlotAnswers): SlotAnswers {
  const next = { ...answers };
  delete next[REDIRECT_LEAD_TYPE_ID];
  delete next[REDIRECT_CHANNEL_ID];
  return next;
}

export function withRedirectOffer(
  answers: SlotAnswers,
  offer: { leadTypeId: string; channelId: string },
): SlotAnswers {
  return {
    ...clearRedirectOffer(answers),
    [REDIRECT_LEAD_TYPE_ID]: offer.leadTypeId,
    [REDIRECT_CHANNEL_ID]: offer.channelId,
  };
}

export function rememberDeclinedLeadType(answers: SlotAnswers, leadTypeId: string) {
  const next = clearRedirectOffer(answers);
  const ids = new Set(declinedLeadTypeIds(next));
  ids.add(leadTypeId);
  next[REDIRECT_DECLINED_IDS] = [...ids].join(",");
  return next;
}

export async function evaluateEnquiryTurn(params: {
  currentLeadTypeId: string;
  currentLeadTypeName: string;
  leadTypes: EnquiryLeadTypeOption[];
  declinedLeadTypeIds: string[];
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  latestUserMessage: string;
}): Promise<EnquiryDecision> {
  const enabled = params.leadTypes.filter((type) => type.id && type.channelId && type.name);
  const result = await evaluateWithJev({
    purpose: "enquiry-turn",
    state: buildEnquiryState({
      ...params,
      leadTypes: enabled,
    }),
    questions: buildEnquiryQuestions(enabled),
  });
  return mergeEnquiryDecisions({
    answers: result?.answers ?? null,
    currentLeadTypeId: params.currentLeadTypeId,
    leadTypes: enabled,
    declinedLeadTypeIds: params.declinedLeadTypeIds,
  });
}

export async function evaluateEnquiryRedirectAnswer(params: {
  message: string;
  currentLeadTypeName: string;
  offeredLeadTypeName: string;
}): Promise<boolean | null> {
  const result = await evaluateWithJev({
    purpose: "enquiry-redirect",
    state: {
      latestUserMessage: truncateText(params.message),
      selectedLeadType: params.currentLeadTypeName,
      offeredLeadType: params.offeredLeadTypeName,
    },
    questions: {
      acceptRedirect: noul(
        `Did the person agree to continue this enquiry as ${params.offeredLeadTypeName} instead of ${params.currentLeadTypeName}?`,
        {
          true: "They agreed to switch.",
          false: "They declined, or they did not agree.",
        },
      ),
    },
  });
  const answer = asNoulAnswer(result?.answers?.acceptRedirect);
  if (!answer) return null;
  if (answer.noul >= JEV_NOUL_AGREE_MIN) return true;
  if (answer.noul <= 1 - JEV_NOUL_AGREE_MIN) return false;
  return null;
}
