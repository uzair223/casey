import type { StatementConfig, StatementPhaseConfig } from "@/types";

import {
  formatCaseFacts,
  type CaseFact,
} from "@/lib/llm/case-runtime";

export const DEFAULT_MODEL_IDENTITY =
  "You are taking this person's account. The firm prepares the written draft during review.";

const INTERVIEW_INVARIANT = [
  "Ask one question at a time.",
  "Ask one follow-up for each completion criterion that is still missing. If they say they do not recall, close that point and move on. Do not rephrase a question they have already answered. Once this phase is covered, ask the next phase.",
  "When a place, object, injury, treatment, or workplace record comes up, ask once whether they have something that shows it, such as a photo, a medical letter, or an accident-book entry. If they say no or they are not sure, do not ask again. On that turn set metadata.evidence.requestedEvidence. Do not mention an evidence tab.",
  "If they mention another person, ask once whether that person saw what happened, and for a name and how to reach them if they are willing.",
  "When they state an occupation, address, or other witness detail, set that metadata.witnessDetails field on this turn and leave the other witness detail keys null. A job such as courier is the occupation.",
  "When the account already covers what happened, or they ask to stop or say the question is repeating, thank them and say the account is complete. Do not ask another question.",
  "Do not give legal advice.",
  "Do not prepare the written draft in chat.",
].join(" ");

export type TemplateRuntimeContext = {
  witnessMetadata?: Record<string, unknown> | null;
  caseFacts?: CaseFact[];
  matterBrief?: string | null;
  evidenceList?: string;
  priorEnquiry?: string | null;
};

export function modelIdentityText(
  config: Pick<StatementConfig, "modelIdentity">,
): string {
  const identity = config.modelIdentity?.trim();
  return identity || DEFAULT_MODEL_IDENTITY;
}

function questioningModeInstruction(
  mode: StatementPhaseConfig["questioningMode"],
): string {
  if (mode === "narrative") {
    return "Ask for a free account. Follow up only for completion criteria that are still missing.";
  }
  if (mode === "structured") {
    return "Ask one factual question at a time.";
  }
  if (mode === "mixed") {
    return "Start with a free account, then ask gap questions for missing completion criteria.";
  }
  return "Ask one question about this phase only.";
}

function formatPhase(phase: StatementPhaseConfig, index: number): string {
  const lines = [`${index + 1}. ${phase.title}`];
  if (phase.objective.trim()) {
    lines.push(`Objective: ${phase.objective.trim()}`);
  }
  lines.push(`Questioning: ${questioningModeInstruction(phase.questioningMode)}`);
  if (phase.allowedTopics && phase.allowedTopics.length > 0) {
    lines.push(`Stay within: ${phase.allowedTopics.join("; ")}`);
  }
  if (phase.forbiddenTopics && phase.forbiddenTopics.length > 0) {
    lines.push(`Do not ask about: ${phase.forbiddenTopics.join("; ")}`);
  }
  if (phase.completionCriteria && phase.completionCriteria.length > 0) {
    lines.push("Complete when:");
    for (const criterion of phase.completionCriteria) {
      lines.push(`- ${criterion}`);
    }
  }
  return lines.join("\n");
}

export function formatWitnessDetails(
  config: StatementConfig,
  metadata?: Record<string, unknown> | null,
): string {
  const fields = config.witnessMetadataFields ?? [];
  if (fields.length === 0) {
    return "Witness details: none configured.";
  }

  const lines = fields.map((field) => {
    const raw = metadata?.[field.id];
    const value =
      raw == null || raw === ""
        ? "not yet given"
        : typeof raw === "string"
          ? raw
          : String(raw);
    const description = field.description?.trim()
      ? ` — ${field.description.trim()}`
      : "";
    return `- ${field.label} (${field.id}): ${value}${description}`;
  });

  return ["Witness details:", ...lines].join("\n");
}

function formatSections(config: StatementConfig): string {
  if (config.sections.length === 0) {
    return "Sections: none.";
  }

  return [
    "Statement sections:",
    ...config.sections.map((section, index) => {
      const boundary = section.description?.trim();
      return `${index + 1}. ${section.title}${boundary ? `\n${boundary}` : ""}`;
    }),
  ].join("\n\n");
}

export function buildInterviewContract(
  config: StatementConfig,
  runtime: TemplateRuntimeContext = {},
): string {
  const phases =
    config.phases.length > 0
      ? ["Interview phases, in order:", ...config.phases.map(formatPhase)].join(
          "\n\n",
        )
      : "Interview phases: none.";
  const parts = [
    modelIdentityText(config),
    INTERVIEW_INVARIANT,
    phases,
    formatWitnessDetails(config, runtime.witnessMetadata),
    formatCaseFacts(runtime.caseFacts ?? []),
  ];
  const priorEnquiry = runtime.priorEnquiry?.trim();
  if (priorEnquiry) {
    parts.push(
      [
        "Prior enquiry, already said. Do not ask them to repeat it.",
        "If a case fact is still unknown and it belongs in the current phase, ask for that one fact in everyday words. Do not say defendant. Do not ask for several missing facts in one question.",
        "When they state a case fact, set metadata.caseDetails to that field id and value, and leave the other case detail keys null.",
        priorEnquiry,
      ].join("\n"),
    );
  }
  const matterBrief = runtime.matterBrief?.trim();
  if (matterBrief) {
    parts.push(`Matter background:\n${matterBrief}`);
  }
  return parts.join("\n\n");
}

export function buildFormalizeContract(
  config: StatementConfig,
  runtime: TemplateRuntimeContext = {},
): string {
  const evidence =
    runtime.evidenceList?.trim() || "No confirmed evidence provided.";
  const parts = [
    "You are writing this witness's statement.",
    modelIdentityText(config),
    formatSections(config),
    formatWitnessDetails(config, runtime.witnessMetadata),
    formatCaseFacts(runtime.caseFacts ?? []),
    `Confirmed evidence:\n${evidence}`,
  ];
  const priorEnquiry = runtime.priorEnquiry?.trim();
  if (priorEnquiry) {
    parts.push(
      `Prior enquiry the witness already gave. Treat it as part of their account.\n${priorEnquiry}`,
    );
  }
  return parts.join("\n\n");
}

export function formatStatementExpectations(params: {
  witnessName: string;
  templateName: string;
  config: StatementConfig;
}): string {
  const phases =
    params.config.phases.length > 0
      ? params.config.phases
          .map((phase, index) => {
            const criteria = phase.completionCriteria?.length
              ? ` Complete when ${phase.completionCriteria.join("; ")}.`
              : "";
            return `${index + 1}. ${phase.title}: ${phase.objective}${criteria}`;
          })
          .join("\n")
      : "none";
  const sections =
    params.config.sections.length > 0
      ? params.config.sections
          .map((section) => {
            const boundary = section.description?.trim();
            return `- ${section.title}${boundary ? `: ${boundary}` : ""}`;
          })
          .join("\n")
      : "none";

  return [
    `Witness: ${params.witnessName}`,
    `Template: ${params.templateName}`,
    modelIdentityText(params.config),
    `Phases:\n${phases}`,
    `Sections:\n${sections}`,
  ].join("\n");
}

export function openingQuestionForTemplate(config: StatementConfig): string {
  return questionForPhase(config.phases[0]);
}

export function continuationQuestionForTemplate(config: StatementConfig): string {
  return questionForPhase(config.phases[1] ?? config.phases[0]);
}

function questionForPhase(phase: StatementConfig["phases"][number] | undefined) {
  if (!phase) {
    return "Could you please describe what happened, in your own words?";
  }

  const firstCriterion = phase.completionCriteria?.[0]?.trim();
  if (phase.questioningMode === "structured" && firstCriterion) {
    return firstCriterion.endsWith("?") ? firstCriterion : `${firstCriterion}?`;
  }

  return `Could you tell me about ${phase.title.trim().toLowerCase()}?`;
}
