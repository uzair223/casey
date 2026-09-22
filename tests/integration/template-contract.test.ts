import { describe, expect, it } from "vitest";

import {
  buildKnownCaseFacts,
  formatCaseFieldsForAnalysis,
} from "@/lib/llm/case-runtime";
import {
  buildFormalizeContract,
  buildInterviewContract,
  DEFAULT_MODEL_IDENTITY,
  formatStatementExpectations,
} from "@/lib/llm/template-contract";
import { generateChatSystemPrompt } from "@/lib/llm/prompts";
import { CaseConfigSchema, StatementConfigSchema } from "@/lib/schema";
import { SEEDED_CASE_TEMPLATES } from "@/lib/templates/claimant-firm-seeds";
import type { CaseConfig, StatementConfig } from "@/types";

const statementConfig: StatementConfig = {
  schemaVersion: 4,
  modelIdentity: "You are interviewing the claimant in a road traffic collision.",
  phases: [
    {
      id: "collision",
      title: "The collision",
      objective: "How the vehicles came into contact.",
      allowedTopics: null,
      forbiddenTopics: ["legal blame"],
      completionCriteria: ["Point of impact"],
      questioningMode: "narrative",
    },
  ],
  sections: [
    {
      id: "collision",
      title: "The collision",
      description: "The claimant's account of impact.",
    },
  ],
  witnessMetadataFields: [
    {
      id: "occupation",
      label: "Occupation",
      description: null,
      requiredOnIntake: false,
      requiredOnCreate: false,
    },
  ],
  caseMetadataDeps: ["accidentDate"],
};

const caseConfig: CaseConfig = {
  matterBrief: "A junction collision in Manchester.",
  dynamicFields: [
    { id: "court", label: "Court", description: "The court hearing the claim." },
    { id: "accidentDate", label: "Accident date", type: "date" },
  ],
};

describe("template contract", () => {
  it("leads the interview with the firm's identity and only named case facts", () => {
    const prompt = generateChatSystemPrompt(statementConfig, {
      witnessMetadata: { occupation: "Driver" },
      matterBrief: caseConfig.matterBrief,
      caseFacts: buildKnownCaseFacts({
        caseConfig,
        caseMetadata: { court: "Manchester County Court", accidentDate: "2024-05-01" },
        dependencyIds: statementConfig.caseMetadataDeps,
      }),
    });

    expect(prompt.startsWith(statementConfig.modelIdentity ?? "")).toBe(true);
    expect(prompt).toContain("Ask one question at a time.");
    expect(prompt).toContain("How the vehicles came into contact.");
    expect(prompt).toContain("Do not ask about: legal blame");
    expect(prompt).toContain("Accident date (accidentDate): 2024-05-01");
    expect(prompt).not.toContain("Manchester County Court");
    expect(prompt).toContain("A junction collision in Manchester.");
    expect(prompt).toContain("Occupation (occupation): Driver");
  });

  it("uses the default identity and injects no case facts when deps are empty", () => {
    const prompt = buildInterviewContract(
      { ...statementConfig, modelIdentity: "  ", caseMetadataDeps: [] },
      {
        caseFacts: buildKnownCaseFacts({
          caseConfig,
          caseMetadata: { court: "Manchester County Court" },
          dependencyIds: [],
        }),
      },
    );

    expect(prompt.startsWith(DEFAULT_MODEL_IDENTITY)).toBe(true);
    expect(prompt).toContain("Case facts: none.");
    expect(prompt).not.toContain("Manchester County Court");
  });

  it("leads the formalizer with the writing role, the same identity, and the evidence list", () => {
    const prompt = buildFormalizeContract(statementConfig, {
      evidenceList: "1. Photograph of the junction",
      caseFacts: buildKnownCaseFacts({
        caseConfig,
        caseMetadata: { accidentDate: "2024-05-01" },
        dependencyIds: ["accidentDate"],
      }),
    });

    expect(prompt.startsWith("You are writing this witness's statement.")).toBe(
      true,
    );
    expect(prompt).toContain(statementConfig.modelIdentity);
    expect(prompt).toContain("The claimant's account of impact.");
    expect(prompt).toContain("Photograph of the junction");
    expect(prompt).not.toContain("{{");
  });

  it("shows every case field to analysis, including the statement identity", () => {
    const fields = formatCaseFieldsForAnalysis({
      caseConfig,
      caseMetadata: { court: "Manchester County Court", orphanNote: "kept" },
    });
    expect(fields).toContain("Court (court)");
    expect(fields).toContain("The court hearing the claim.");
    expect(fields).toContain("Accident date (accidentDate)");
    expect(fields).toContain("orphanNote: kept");

    const expectations = formatStatementExpectations({
      witnessName: "Jane Doe",
      templateName: "Claimant",
      config: statementConfig,
    });
    expect(expectations).toContain(
      "You are interviewing the claimant in a road traffic collision.",
    );
    expect(expectations).toContain("Template: Claimant");
    expect(expectations).toContain("How the vehicles came into contact.");
  });

  it("seeds four published claimant matters with one default statement each", () => {
    expect(SEEDED_CASE_TEMPLATES).toHaveLength(4);
    for (const caseTemplate of SEEDED_CASE_TEMPLATES) {
      expect(CaseConfigSchema.safeParse(caseTemplate.config).success).toBe(true);
      expect(
        caseTemplate.statements.filter((link) => link.isDefault),
      ).toHaveLength(1);
      const fieldIds = caseTemplate.config.dynamicFields.map((field) => field.id);
      expect(fieldIds).toEqual(
        expect.arrayContaining(["court", "claimNumber", "claimant", "defendant"]),
      );
      for (const link of caseTemplate.statements) {
        const parsed = StatementConfigSchema.safeParse(link.template.config);
        expect(parsed.success).toBe(true);
        expect(link.template.config.modelIdentity?.startsWith("You are interviewing")).toBe(
          true,
        );
        expect(link.template.config.caseMetadataDeps).toEqual(fieldIds);
        expect(link.template.config.witnessMetadataFields.map((field) => field.id)).toEqual([
          "address",
          "occupation",
        ]);
        expect(link.template.config.phases.every((phase) => phase.objective.trim())).toBe(
          true,
        );
      }
    }
  });
});
