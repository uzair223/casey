import { StatementConfig } from "@/types";

export const EMPTY_STATEMENT_CONFIG: StatementConfig = {
  agents: {
    chat: "",
    formalize: "",
  },
  prompts: null,
  phases: [],
  sections: [],
  witness_metadata_fields: [],
  case_metadata_deps: [],
};

export function normalizeConfig(value: unknown): StatementConfig {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      ...EMPTY_STATEMENT_CONFIG,
      ...(value as Partial<StatementConfig>),
    };
  }

  return EMPTY_STATEMENT_CONFIG;
}
