import type { StatementConfig, StatementPhaseConfig } from "@/types";

import {
  formatCaseFacts,
  type CaseFact,
} from "@/lib/llm/case-runtime";

export const DEFAULT_MODEL_IDENTITY =
  "You are interviewing a witness to prepare their statement.";

const INTERVIEW_INVARIANT = [
  "Ask one question at a time.",
  "Stay on the current phase.",
  "Do not give legal advice.",
  "Do not draft the statement in chat.",
].join(" ");

export type TemplateRuntimeContext = {
  witnessMetadata?: Record<string, unknown> | null;
  caseFacts?: CaseFact[];
  matterBrief?: string | null;
  evidenceList?: string;
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
  return [
    "You are writing this witness's statement.",
    modelIdentityText(config),
    formatSections(config),
    formatWitnessDetails(config, runtime.witnessMetadata),
    formatCaseFacts(runtime.caseFacts ?? []),
    `Confirmed evidence:\n${evidence}`,
  ].join("\n\n");
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
  const phase = config.phases[0];
  if (!phase) {
    return "Could you please describe what happened, in your own words?";
  }

  const firstCriterion = phase.completionCriteria?.[0]?.trim();
  if (phase.questioningMode === "structured" && firstCriterion) {
    return firstCriterion.endsWith("?") ? firstCriterion : `${firstCriterion}?`;
  }

  const about = `Could you tell me about ${phase.title.trim().toLowerCase()}?`;
  const objective = phase.objective.trim();
  return objective ? `${about} ${objective}` : about;
}
