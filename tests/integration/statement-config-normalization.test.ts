import { describe, expect, it } from "vitest";
import { StatementConfigSchema } from "@/lib/schema";
import {
  CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION,
  normalizeConfig,
} from "@/lib/statement-utils";

describe("statement config normalization", () => {
  it("keeps camelCase fields and drops stored prompts and phase description", () => {
    const config = normalizeConfig({
      schema_version: 3,
      agents: {
        chat: "Legacy chat agent",
        formalize: "Legacy formalize agent",
      },
      prompts: {
        chat_system_template: "override",
        formalize_system_template: "override",
      },
      modelIdentity: "  You are interviewing the witness of a road traffic accident.  ",
      phases: [
        {
          id: "incidentNarrative",
          title: "Incident Narrative",
          description: "This old field is ignored.",
          objective: "What happened, in the witness's own account.",
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
          id: "ignored",
          label: "Ignored",
          description: "Old key",
          requiredOnCreate: false,
          requiredOnIntake: true,
        },
      ],
      witnessMetadataFields: [
        {
          id: "address",
          label: "Address",
          description: "Residential address",
          requiredOnCreate: false,
          requiredOnIntake: true,
          legacyField: "ignored",
        },
      ],
      case_metadata_deps: ["court"],
      caseMetadataDeps: ["court", "claimNumber"],
      legacyRootField: "ignored",
    });

    expect(config.schemaVersion).toBe(CURRENT_STATEMENT_CONFIG_SCHEMA_VERSION);
    expect(config.modelIdentity).toBe(
      "You are interviewing the witness of a road traffic accident.",
    );
    expect("prompts" in config).toBe(false);
    expect("agents" in config).toBe(false);
    expect(config.phases).toEqual([
      {
        id: "incidentNarrative",
        title: "Incident Narrative",
        objective: "What happened, in the witness's own account.",
        allowedTopics: ["sequence of events"],
        forbiddenTopics: ["legal conclusions"],
        completionCriteria: ["chronology captured"],
        questioningMode: "narrative",
      },
    ]);
    expect(config.sections).toHaveLength(1);
    expect(config.witnessMetadataFields.map((field) => field.id)).toEqual([
      "address",
    ]);
    expect(config.caseMetadataDeps).toEqual(["court", "claimNumber"]);
    expect(StatementConfigSchema.safeParse(config).success).toBe(true);
  });

  it("does not treat an empty caseMetadataDeps list as every case field", () => {
    const config = normalizeConfig({
      phases: [{ id: "facts", title: "Facts", objective: "What happened." }],
      sections: [{ id: "facts", title: "Facts", description: null }],
      caseMetadataDeps: [],
    });

    expect(config.caseMetadataDeps).toEqual([]);
    expect(config.modelIdentity).toBeNull();
  });
});
