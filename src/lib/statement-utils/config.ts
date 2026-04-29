import type {
  StatementConfig,
  StatementMetadataFieldConfig,
  StatementPhaseConfig,
  StatementPromptTemplates,
  StatementSectionConfig,
} from "@/types";

export const CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION = 2;

export const EMPTY_STATEMENT_CONFIG: StatementConfig = {
  schema_version: CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION,
  agents: {
    chat: "",
    formalize: "",
  },
  prompts: {
    chat_system_template: null,
    formalize_system_template: null,
  },
  phases: [],
  sections: [],
  witness_metadata_fields: [],
  case_metadata_deps: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableBooleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function nullableStringArrayValue(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return strings.length > 0 ? strings : null;
}

function normalizePrompts(value: unknown): StatementPromptTemplates {
  const source = isRecord(value) ? value : {};

  return {
    chat_system_template: nullableStringValue(source.chat_system_template),
    formalize_system_template: nullableStringValue(
      source.formalize_system_template,
    ),
  };
}

function normalizePhase(value: unknown): StatementPhaseConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringValue(value.id).trim();
  const title = stringValue(value.title).trim();

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    description: stringValue(value.description),
    allowedTopics: nullableStringArrayValue(value.allowedTopics),
    forbiddenTopics: nullableStringArrayValue(value.forbiddenTopics),
    completionCriteria: nullableStringArrayValue(value.completionCriteria),
    questioningMode:
      value.questioningMode === "narrative" ||
      value.questioningMode === "structured" ||
      value.questioningMode === "mixed"
        ? value.questioningMode
        : null,
  };
}

function normalizeSection(value: unknown): StatementSectionConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringValue(value.id).trim();
  const title = stringValue(value.title).trim();

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    description: nullableStringValue(value.description),
  };
}

function normalizeWitnessMetadataField(
  value: unknown,
): StatementMetadataFieldConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringValue(value.id).trim();
  const label = stringValue(value.label).trim();

  if (!id || !label) {
    return null;
  }

  return {
    id,
    label,
    description: nullableStringValue(value.description),
    requiredOnIntake: nullableBooleanValue(value.requiredOnIntake),
    requiredOnCreate: nullableBooleanValue(value.requiredOnCreate),
  };
}

export function normalizeConfig(value: unknown): StatementConfig {
  if (isRecord(value)) {
    const agents = isRecord(value.agents) ? value.agents : {};

    return {
      schema_version: CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION,
      agents: {
        chat: stringValue(agents.chat),
        formalize: stringValue(agents.formalize),
      },
      prompts: normalizePrompts(value.prompts),
      phases: Array.isArray(value.phases)
        ? value.phases.flatMap((phase) => {
            const normalized = normalizePhase(phase);
            return normalized ? [normalized] : [];
          })
        : [],
      sections: Array.isArray(value.sections)
        ? value.sections.flatMap((section) => {
            const normalized = normalizeSection(section);
            return normalized ? [normalized] : [];
          })
        : [],
      witness_metadata_fields: Array.isArray(value.witness_metadata_fields)
        ? value.witness_metadata_fields.flatMap((field) => {
            const normalized = normalizeWitnessMetadataField(field);
            return normalized ? [normalized] : [];
          })
        : [],
      case_metadata_deps: Array.isArray(value.case_metadata_deps)
        ? value.case_metadata_deps.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
    };
  }

  return EMPTY_STATEMENT_CONFIG;
}
