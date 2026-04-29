import { describe, expect, it } from "vitest";
import { StatementConfigSchema } from "@/lib/schema";
import {
  CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION,
  normalizeConfig,
} from "@/lib/statement-utils";

describe("statement config normalization", () => {
  it("strips legacy prompt keys without dropping phases or sections", () => {
    const config = normalizeConfig({
      agents: {
        chat: "Legacy chat agent",
        formalize: "Legacy formalize agent",
      },
      prompts: {
        chat_system_template: null,
        metadata_system_template: null,
        formalize_system_template: null,
      },
      phases: [
        {
          id: "incidentNarrative",
          title: "Incident Narrative",
          description: "Collect what happened.",
          allowedTopics: ["sequence of events"],
          forbiddenTopics: ["legal conclusions"],
          completionCriteria: ["chronology captured"],
          questioningMode: "narrative",
          legacyField: "ignored",
        },
      ],
      sections: [
        {
          id: "incidentDescription",
          title: "Incident Description",
          description: "A detailed account of the incident.",
          legacyField: "ignored",
        },
      ],
      witness_metadata_fields: [
        {
          id: "address",
          label: "Address",
          description: "Residential address",
          requiredOnCreate: false,
          requiredOnIntake: true,
          legacyField: "ignored",
        },
      ],
      case_metadata_deps: ["court", "claimNumber"],
      legacyRootField: "ignored",
    });

    expect(config.schema_version).toBe(CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION);
    expect(config.prompts).toEqual({
      chat_system_template: null,
      formalize_system_template: null,
    });
    expect("agents" in config).toBe(false);
    expect(config.phases).toHaveLength(1);
    expect(config.sections).toHaveLength(1);
    expect(config.witness_metadata_fields).toHaveLength(1);
    expect(StatementConfigSchema.safeParse(config).success).toBe(true);
  });
});
