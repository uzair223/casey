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
  "When a place, object, injury, treatment, or workplace record comes up, ask once whether they have something that shows it, such as a photo, a medical letter, or an accident-book entry. If they say no or they are not sure, do not ask again. On that turn set metadata.evidence.requestedEvidence. The evidence name is a short label of a few words, such as \"Roll cage photo\" or \"Accident book\", not a sentence. Do not mention an evidence tab.",
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

const SPECIFIC_CRITERION_QUESTIONS: Array<{
  match: RegExp;
  question: string;
  answered?: RegExp;
}> = [
  {
    match: /role and duties|^their job$|^role$/,
    question: "What did that job involve?",
    answered: /\b(courier|driver|nurse|carer|cleaner|operative|warehouse|manager|teacher|chef|builder|i (?:am|was) an?|my job|i work)\b/i,
  },
  {
    match: /task at the time/,
    question: "What were you doing at the moment it happened?",
  },
  {
    match: /training or instructions/,
    question: "What training or instructions had you been given for that work?",
    answered: /\b(training|induction|instructed|shown how)\b/i,
  },
  {
    match: /what the claimant was doing|what they were doing/,
    question: "What were you doing in the moment before it happened?",
  },
  {
    match: /how they were hurt|how the claimant was hurt|how the accident happened/,
    question: "How were you hurt?",
    answered: /\b(fractur|broke|broken|injur|sprain|cut|burn|bruise|pain|hurt|fell)\b/i,
  },
  {
    match: /equipment or conditions/,
    question: "What equipment or workplace conditions were involved?",
  },
  {
    match: /point of impact/,
    question: "Where did the other vehicle hit yours?",
  },
  {
    match: /what the claimant saw|^what they saw$/,
    question: "What did you see just before it happened?",
  },
  {
    match: /what the claimant did/,
    question: "What did you do as it happened?",
  },
  {
    match: /journey and destination/,
    question: "Where were you going?",
    answered: /\b(going to|on my way|driving to|heading to)\b/i,
  },
  {
    match: /who was in the vehicle/,
    question: "Who else was in the vehicle?",
    answered: /\b(alone|on my own|passenger|nobody else|no one else)\b/i,
  },
  {
    match: /road and weather/,
    question: "What were the road and the weather like?",
  },
  {
    match: /who was told|^who they told$/,
    question: "Who did you tell afterwards?",
    answered: /\b(i told|told my|reported it|let my manager)\b/i,
  },
  {
    match: /first aid or medical/,
    question: "Did anyone give first aid, or have you seen a doctor?",
  },
  {
    match: /recorded/,
    question: "Was it written down at work?",
  },
  {
    match: /^injuries noticed$|^injuries$/,
    question: "What injuries did you notice?",
    answered: /\b(fractur|broke|broken|injur|sprain|cut|burn|bruise)\b/i,
  },
  {
    match: /^treatment received$|^treatment$/,
    question: "What treatment have you had?",
    answered: /\b(hospital|doctor|a&e|gp|physio|x-ray|surgery|treatment)\b/i,
  },
  {
    match: /treatment is ongoing/,
    question: "Is that treatment still going on?",
  },
  {
    match: /time off work/,
    question: "Have you been back to work since?",
    answered: /\b(time off|off work|signed off|not been back)\b/i,
  },
  {
    match: /reason for being there|^why they were there$/,
    question: "Why were you there?",
  },
  {
    match: /what the hazard was/,
    question: "What was it that caused you to be hurt?",
  },
  {
    match: /warning was visible|warning the witness saw/,
    question: "Was there a warning you could see?",
  },
  {
    match: /what the claimant was looking at/,
    question: "What were you looking at when it happened?",
  },
  {
    match: /^symptoms$/,
    question: "What symptoms did you have?",
  },
  {
    match: /why they attended/,
    question: "Why did you go in for treatment?",
  },
  {
    match: /who saw them/,
    question: "Who saw you?",
  },
  {
    match: /what was done/,
    question: "What did they actually do?",
  },
  {
    match: /advice or warnings/,
    question: "What were you told about the risks?",
  },
  {
    match: /offered a choice/,
    question: "Were you offered a choice?",
  },
  {
    match: /who lives there/,
    question: "Who lives there with you?",
  },
  {
    match: /kind of home/,
    question: "What kind of home is it?",
  },
  {
    match: /what is wrong/,
    question: "What is wrong with the home?",
    answered: /\b(damp|mould|mold|leak|ceiling|heating|boiler|window|roof)\b/i,
  },
  {
    match: /how long it has been wrong|how long they have seen it/,
    question: "How long has it been like that?",
  },
];

function questionForCriterion(criterion: string) {
  const text = criterion.trim().replace(/[?.]$/, "").toLowerCase();
  const known = SPECIFIC_CRITERION_QUESTIONS.find((item) => item.match.test(text));
  if (known) return known.question;
  if (/^(what|who|where|when|how|did|was|were|is|are)\b/i.test(text)) {
    return `${text}?`;
  }
  if (/^whether\b/i.test(text)) {
    const rest = text.replace(/^whether\s+/i, "");
    return `${rest.charAt(0).toUpperCase()}${rest.slice(1)}?`;
  }
  const lower = text.charAt(0).toLowerCase() + text.slice(1);
  return `What was ${lower}?`;
}

function criterionAlreadyAnswered(criterion: string, priorAccount: string) {
  const text = criterion.trim().replace(/[?.]$/, "").toLowerCase();
  const known = SPECIFIC_CRITERION_QUESTIONS.find((item) => item.match.test(text));
  return Boolean(known?.answered && known.answered.test(priorAccount));
}

export function continuationQuestionForTemplate(
  config: Pick<StatementConfig, "phases">,
  priorAccount = "",
): string {
  const account = priorAccount.trim();
  for (const phase of config.phases) {
    for (const criterion of phase.completionCriteria ?? []) {
      const text = criterion.trim();
      if (!text) continue;
      if (account && criterionAlreadyAnswered(text, account)) continue;
      return questionForCriterion(text);
    }
  }
  return "What were you doing in the moment before it happened?";
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
