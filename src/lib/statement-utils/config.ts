import type {
  StatementConfig,
  StatementMetadataFieldConfig,
  StatementPhaseConfig,
  StatementSectionConfig,
} from "@/types";

export const CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION = 4;

export const EMPTY_STATEMENT_CONFIG: StatementConfig = {
  schemaVersion: CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION,
  modelIdentity: null,
  phases: [],
  sections: [],
  witnessMetadataFields: [],
  caseMetadataDeps: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
    objective: stringValue(value.objective).trim(),
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
  if (!isRecord(value)) {
    return EMPTY_STATEMENT_CONFIG;
  }

  return {
    schemaVersion: CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION,
    modelIdentity: nullableStringValue(value.modelIdentity),
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
    witnessMetadataFields: Array.isArray(value.witnessMetadataFields)
      ? value.witnessMetadataFields.flatMap((field) => {
          const normalized = normalizeWitnessMetadataField(field);
          return normalized ? [normalized] : [];
        })
      : [],
    caseMetadataDeps: Array.isArray(value.caseMetadataDeps)
      ? value.caseMetadataDeps
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}
