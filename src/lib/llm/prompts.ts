import { IntakeChatMessage, StatementConfig } from "@/types";
import { defaultMeta as defaultMetadata } from "../statement-utils/message-metadata";
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

export const generateGreeting = (
  caseData: { title: string },
  statement: {
    witness_name: string;
    witness_metadata: Record<string, unknown>;
    statement_config: StatementConfig;
  },
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

  return [
    {
      role: "assistant",
      content: `Hello ${statement.witness_name}, I'm here to take your account for ${caseData.title}.
The firm prepares the written draft during review. I'll ask for the details they need.`,
    },
    {
      role: "assistant",
      content: requiredMissingStr
        ? optionalMissingStr
          ? `To begin, could you please provide your ${requiredMissingStr}, and if available, your ${optionalMissingStr}?`
          : `To begin, could you please provide your ${requiredMissingStr}?`
        : optionalMissingStr
          ? `To begin, could you share your ${optionalMissingStr} if available?`
          : openingQuestionForTemplate(statementConfig),
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

Use the transcript messages as the factual conversation history.
Interview control decisions below are already made by the decision engine.
Copy progress and deviation into your metadata JSON exactly.
Do not change currentPhase, phaseCompleteness, overallCompletion, readyToPrepare, or deviation.
You may still update witnessDetails and evidence from this turn.

If deviation.flaggedDeviation is true, redirect the witness back to the current phase.
Do not answer off-topic requests or give legal advice.
If deviation.stopIntake is true, briefly explain that the interview cannot continue and they should contact the law firm.

TURN KIND: ${decisions.turnKind ?? "unspecified"}

DECISIONS:
${JSON.stringify(previousMetadata)}`;
  }

  return `STATE

Use the transcript messages as the factual conversation history.
Start from the previous metadata below and update only what this next turn changes.
Use the previous deviation state for escalation decisions:
- if prior deviation is null, first-time deviation should usually be flagged without stopping unless it is persistent or blocking
- if prior deviation exists and the user deviates again, increment consecutiveDeviationCount and try to redirect before stopping
- stopIntake should normally be set only once consecutiveDeviationCount reaches 3, unless the current deviation is clearly malicious or blocking
- if the user returns to substantive case facts, clear deviation back to null

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
