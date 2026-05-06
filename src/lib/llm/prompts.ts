import { IntakeChatMessage, StatementConfig } from "@/types";
import { defaultMeta as defaultMetadata } from "../statement-utils/message-metadata";

export type PromptTemplateTokens =
  | "phasesList"
  | "witnessDetailFieldList"
  | "sectionGuidelines"
  | "jsonStructure"
  | "evidenceList";

export const PROMPT_TEMPLATE_TOKEN_HELP: Array<{
  token: string;
  description: string;
}> = [
  {
    token: "template.*",
    description:
      "Generic access to statement template config (e.g. {{template.phases.0.title}})",
  },
  {
    token: "phasesList",
    description: "Enumerated list of configured phases",
  },
  {
    token: "witnessDetailFieldList",
    description: "Configured witness metadata fields",
  },
  {
    token: "sectionGuidelines",
    description: "Generated section writing guidance",
  },
  {
    token: "jsonStructure",
    description: "Strict JSON response shape for formalization",
  },
  {
    token: "evidenceList",
    description:
      "Rendered list of confirmed evidence provided for formalization",
  },
];

type PromptComputedContext = Record<PromptTemplateTokens, string>;

function buildPromptTemplateContext(
  config: StatementConfig,
): PromptComputedContext {
  const phasesList = config.phases
    .map((phase, index) => {
      const lines = [`${index + 1}. ${phase.title}: ${phase.description}`];

      if (phase.questioningMode) {
        lines.push(`   - Questioning mode: ${phase.questioningMode}`);
      }

      if (phase.allowedTopics && phase.allowedTopics.length > 0) {
        lines.push(`   - Allowed topics: ${phase.allowedTopics.join(", ")}`);
      }

      if (phase.forbiddenTopics && phase.forbiddenTopics.length > 0) {
        lines.push(
          `   - Forbidden topics: ${phase.forbiddenTopics.join(", ")}`,
        );
      }

      if (phase.completionCriteria && phase.completionCriteria.length > 0) {
        lines.push("   - Completion criteria:");
        lines.push(
          ...phase.completionCriteria.map((criterion) => `     - ${criterion}`),
        );
      }

      return lines.join("\n");
    })
    .join("\n");

  const witnessDetailFieldList = (config.witness_metadata_fields ?? [])
    .map((field) => `- ${field.id}: ${field.description ?? field.label}`)
    .join("\n");

  const sectionGuidelines = config.sections
    .map((section) => {
      let guideline = `${section.title.toUpperCase()} (1-2 sentences)`;
      if (section.description) {
        guideline += `\n- ${section.description}`;
      }
      return guideline;
    })
    .join("\n\n");

  const jsonFields = config.sections
    .map((section) => `"${section.id}": ""`)
    .join(",\n  ");

  const jsonStructure = `{\n  ${jsonFields}\n}`;

  const context: PromptComputedContext = {
    phasesList,
    witnessDetailFieldList,
    sectionGuidelines,
    jsonStructure,
    evidenceList: "",
  };

  return context;
}

function getByPath(source: unknown, path: string): unknown {
  if (!path.trim()) {
    return source;
  }

  const segments = path.split(".").filter(Boolean);
  let current: unknown = source;

  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function stringifyTemplateValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function renderPromptTemplate(
  template: string,
  context: PromptComputedContext,
  config: StatementConfig,
): string {
  return template.replace(
    /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g,
    (match, rawKey) => {
      const key = String(rawKey).trim();
      const computed = context[key as keyof PromptComputedContext];
      if (typeof computed === "string") {
        return computed;
      }

      if (key === "template" || key === "config") {
        return stringifyTemplateValue(config);
      }

      if (key.startsWith("template.")) {
        const resolved = getByPath(config, key.slice("template.".length));
        return resolved === undefined
          ? match
          : stringifyTemplateValue(resolved);
      }

      return match;
    },
  );
}

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
  const witnessFields = statementConfig.witness_metadata_fields ?? [];

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
  const witnessFields = statementConfig.witness_metadata_fields ?? [];

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
      content: `Hello ${statement.witness_name}, I'm here to help you prepare your witness statement for ${caseData.title}.
I'll guide you through the information collection process to ensure we capture all the important details accurately.`,
    },
    {
      role: "assistant",
      content: requiredMissingStr
        ? optionalMissingStr
          ? `To begin, could you please provide your ${requiredMissingStr}, and if available, your ${optionalMissingStr}?`
          : `To begin, could you please provide your ${requiredMissingStr}?`
        : optionalMissingStr
          ? `To begin, could you share your ${optionalMissingStr} if available?`
          : "To begin, could you please describe the incident in your own words?",
      meta: metadata,
    },
  ];
};

/**
 * Generate chat system prompt with defaults fetched from the database.
 * Use this in API routes to get the latest prompt versions.
 */
export async function generateChatSystemPrompt(
  config: StatementConfig,
): Promise<string> {
  const context = buildPromptTemplateContext(config);
  const { getSystemConfig } = await import("@/lib/supabase/system-config");
  const prompt =
    config.prompts?.chat_system_template ??
    (await getSystemConfig("default_chat_system_prompt"));
  return renderPromptTemplate(prompt, context, config);
}

export function generateIntakeStatePrompt(previousMetadata: unknown): string {
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

export async function generateFormalizeSystemPrompt(
  config: StatementConfig,
  evidenceList = "No confirmed evidence provided.",
): Promise<string> {
  const context = buildPromptTemplateContext(config);
  const { getSystemConfig } = await import("@/lib/supabase/system-config");
  const prompt =
    config.prompts?.formalize_system_template ??
    (await getSystemConfig("default_formalize_system_prompt"));
  const evidenceContext = {
    ...context,
    evidenceList,
  };
  return renderPromptTemplate(prompt, evidenceContext, config);
}
