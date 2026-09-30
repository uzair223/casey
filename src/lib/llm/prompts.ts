import { IntakeChatMessage, StatementConfig } from "@/types";
import { defaultMeta as defaultMetadata } from "../statement-utils/message-metadata";
import { overviewAsSpoken } from "./second-person";
import {
  buildFormalizeContract,
  buildInterviewContract,
  openingQuestionForTemplate,
  type TemplateRuntimeContext,
} from "./template-contract";

export function getMissingRequiredWitnessFieldLabels(statement: {
  witness_metadata: Record<string, unknown>;
  statement_config: StatementConfig;
}): string[] {
  return getMissingWitnessFieldLabels(statement).required;
}

export function getMissingWitnessFieldLabels(statement: {
  witness_metadata: Record<string, unknown>;
  statement_config: StatementConfig;
}): { required: string[]; optional: string[] } {
  const required: string[] = [];
  const optional: string[] = [];
  const statementConfig = statement.statement_config;
  const witnessFields = statementConfig.witnessMetadataFields ?? [];

  for (const field of witnessFields) {
    const value = statement.witness_metadata[field.id];
    const isMissing = value === null || value === undefined || value === "";
    if (!isMissing) {
      continue;
    }

    if (field.requiredOnIntake ?? false) {
      required.push(field.label.toLowerCase());
    } else {
      optional.push(field.label.toLowerCase());
    }
  }

  return { required, optional };
}

function greetingName(witnessName: string) {
  const first = witnessName.trim().split(/\s+/)[0];
  return first || "there";
}

function spokenMatter(caseTitle: string, witnessName: string) {
  const fullName = witnessName.trim();
  const firstName = fullName.split(/\s+/)[0] ?? "";
  let matter = caseTitle.trim();
  for (const name of [fullName, firstName]) {
    if (!name) continue;
    matter = matter.replace(new RegExp(escapeRegExp(name), "ig"), " ");
  }
  matter = matter
    .replace(/[—–|]/g, " ")
    .replace(/^[\s,:.-]+|[\s,:.-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!matter) return "";
  return matter.charAt(0).toLowerCase() + matter.slice(1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fallbackAccountGreeting(witnessName: string, caseTitle: string) {
  const name = greetingName(witnessName);
  const matter = spokenMatter(caseTitle, witnessName);
  if (!matter) {
    return `Hi ${name}, I'm here to take your full account of what happened.`;
  }
  return `Hi ${name}, I'm here to take your full account for your ${matter}.`;
}

export function witnessFacingEnquiry(summary: string | null | undefined) {
  const spoken = overviewAsSpoken(summary).replace(/[.]+$/, "");
  if (!spoken) return "";
  const body = spoken.charAt(0).toLowerCase() + spoken.slice(1);
  return `You told us ${body}.`;
}

export function accountCoverage(phaseTitles: string[] | null | undefined) {
  const names = (phaseTitles ?? [])
    .map((title) => title.trim())
    .filter(Boolean)
    .map((title) => title.charAt(0).toLowerCase() + title.slice(1));
  if (!names.length) return "";
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
  return `We'll go through ${list}.`;
}

export type AccountGreetingContext = {
  enquirySummary?: string | null;
  phaseTitles?: string[];
};

export const generateGreeting = (
  caseData: { title: string },
  statement: {
    witness_name: string;
    witness_metadata: Record<string, unknown>;
    statement_config: StatementConfig;
  },
  context?: AccountGreetingContext | null,
): IntakeChatMessage[] => {
  const missing = getMissingWitnessFieldLabels(statement);
  const statementConfig = statement.statement_config;
  const witnessFields = statementConfig.witnessMetadataFields ?? [];

  const witnessDetails = Object.fromEntries(
    witnessFields
      .map((field) => [field.id, statement.witness_metadata[field.id]])
      .filter(([, value]) => value !== undefined),
  );

  const metadata = defaultMetadata(statementConfig);
  metadata.witnessDetails = witnessDetails;

  const requiredMissingStr = missing.required.length
    ? missing.required.length > 2
      ? `${missing.required.slice(0, -1).join(", ")} and ${missing.required.at(-1)}`
      : missing.required.join(" and ")
    : null;

  const optionalMissingStr = missing.optional.length
    ? missing.optional.length > 2
      ? `${missing.optional.slice(0, -1).join(", ")} and ${missing.optional.at(-1)}`
      : missing.optional.join(" and ")
    : null;

  const phaseTitles =
    context?.phaseTitles ??
    statementConfig.phases.map((phase) => phase.title);
  const intro = [
    fallbackAccountGreeting(statement.witness_name, caseData.title),
    witnessFacingEnquiry(context?.enquirySummary),
    accountCoverage(phaseTitles),
  ]
    .filter(Boolean)
    .join(" ");
  const firstQuestion = statementConfig.phases.length
    ? openingQuestionForTemplate(statementConfig)
    : requiredMissingStr
      ? optionalMissingStr
        ? `To begin, could you please provide your ${requiredMissingStr}, and if available, your ${optionalMissingStr}?`
        : `To begin, could you please provide your ${requiredMissingStr}?`
      : optionalMissingStr
        ? `To begin, could you share your ${optionalMissingStr} if available?`
        : openingQuestionForTemplate(statementConfig);

  return [
    {
      role: "assistant",
      content: intro,
    },
    {
      role: "assistant",
      content: firstQuestion,
      meta: metadata,
    },
  ];
};

export function generateChatSystemPrompt(
  config: StatementConfig,
  runtime: TemplateRuntimeContext = {},
): string {
  return buildInterviewContract(config, runtime);
}

export function generateIntakeStatePrompt(
  previousMetadata: unknown,
  decisions?: { usedJev: boolean; turnKind?: string | null } | null,
): string {
  if (decisions?.usedJev) {
    return `STATE

Speak to this person in the second person only. Say you and your. Never say the lead.
Use the transcript messages as the factual conversation history.
Interview control decisions below are already made by the decision engine.
Copy progress and deviation into your metadata JSON exactly.
Do not change currentPhase, phaseCompleteness, overallCompletion, readyToPrepare, or deviation.
You may still update witnessDetails, caseDetails, and evidence from this turn.

If deviation.flaggedDeviation is true, redirect the witness back to the current phase.
Do not answer off-topic requests or give legal advice.
If deviation.stopIntake is true, briefly explain that the interview cannot continue and they should contact the law firm.
If TURN KIND is close_request, or progress.readyToPrepare is true, thank them and say this account is complete. Do not ask another question. Do not describe the interview as stopped or abusive.

TURN KIND: ${decisions.turnKind ?? "unspecified"}

DECISIONS:
${JSON.stringify(previousMetadata)}`;
  }

  return `STATE

Speak to this person in the second person only. Say you and your. Never say the lead.
Use the transcript messages as the factual conversation history.
Start from the previous metadata below and update only what this next turn changes.
Use the previous deviation state for escalation decisions:
- if prior deviation is null, first-time deviation should usually be flagged without stopping unless it is persistent or blocking
- if prior deviation exists and the user deviates again, increment consecutiveDeviationCount and try to redirect before stopping
- stopIntake should normally be set only once consecutiveDeviationCount reaches 3, unless the current deviation is clearly malicious or blocking
- if the user returns to substantive case facts, clear deviation back to null
- if they ask to stop, or say the question is repeating, and they have already described what happened, set readyToPrepare true, clear deviation, thank them, and do not ask another question
- a request to stop is not abusive language

PREVIOUS METADATA:
${JSON.stringify(previousMetadata)}`;
}

export function generateFormalizeSystemPrompt(
  config: StatementConfig,
  evidenceList = "No confirmed evidence provided.",
  runtime: TemplateRuntimeContext = {},
): string {
  return buildFormalizeContract(config, {
    ...runtime,
    evidenceList,
  });
}
