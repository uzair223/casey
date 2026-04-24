import { StatementConfig } from "@/types";

export const EMPTY_STATEMENT_CONFIG: StatementConfig = {
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

export function normalizeConfig(value: unknown): StatementConfig {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const parsed = value as Partial<StatementConfig>;
    return {
      ...EMPTY_STATEMENT_CONFIG,
      ...parsed,
      prompts: parsed.prompts
        ? {
            ...EMPTY_STATEMENT_CONFIG.prompts,
            ...parsed.prompts,
          }
        : EMPTY_STATEMENT_CONFIG.prompts,
    };
  }

  return EMPTY_STATEMENT_CONFIG;
}
