import { describe, expect, it } from "vitest";

import { generateDoc } from "@/lib/doc-gen";
import { extractDocxText } from "@/lib/files";
import { SEEDED_STATEMENT_TEMPLATES } from "@/lib/templates/claimant-firm-seeds";
import type { StatementConfig } from "@/types";

const config = {
  schemaVersion: 4,
  modelIdentity: null,
  phases: [],
  sections: [
    { id: "accidentDescription", title: "Accident Description", description: null },
    { id: "vehicleDetails", title: "Vehicle Details", description: null },
    { id: "evidence", title: "Evidence", description: null },
  ],
  witnessMetadataFields: [
    { id: "address", label: "Address", description: null, requiredOnIntake: null, requiredOnCreate: null },
    { id: "occupation", label: "Occupation", description: null, requiredOnIntake: null, requiredOnCreate: null },
  ],
  caseMetadataDeps: ["court", "claimNumber", "claimant", "defendant"],
} satisfies StatementConfig;

describe("generateDoc missing sections", () => {
  it("does not render missing section tags as the word undefined", async () => {
    const blob = await generateDoc({
      caseMetadata: {
        court: "Manchester County Court",
        claimNumber: "E2E-001",
        claimant: "Jane Doe",
        defendant: "Acme Logistics Ltd",
      },
      witnessName: "Jane Doe",
      witnessEmail: "jane@example.com",
      witnessMetadata: {
        address: "12 King Street, Manchester",
        occupation: "Warehouse operative",
      },
      sections: {
        evidence: "Exhibit JD1: photos of the collapsed pallet.",
      },
      config,
    });

    const text = await extractDocxText(await blob.arrayBuffer());
    expect(text).toContain("WITNESS STATEMENT OF Jane Doe");
    expect(text).toContain(
      "I, Jane Doe, of 12 King Street, Manchester, Warehouse operative, will say as follows:",
    );
    expect(text).toContain("BETWEEN:");
    expect(text).toContain("Accident Description");
    expect(text).toContain("Exhibit JD1: photos of the collapsed pallet.");
    expect(text).not.toContain("Case Metadata");
    expect(text).not.toContain("IN THE");
    expect(text).not.toContain("CLAIM NO");
    expect(text).not.toMatch(/\bundefined\b/);
  });

  it("renders every account template as a witness statement", async () => {
    expect(SEEDED_STATEMENT_TEMPLATES).toHaveLength(10);

    for (const template of SEEDED_STATEMENT_TEMPLATES) {
      const templateConfig = template.config;
      const address = templateConfig.witnessMetadataFields.find(
        (field) => field.id === "address",
      );
      const occupation = templateConfig.witnessMetadataFields.find(
        (field) => field.id === "occupation",
      );
      expect(address?.requiredOnIntake, template.name).toBe(true);
      expect(occupation?.requiredOnIntake, template.name).toBe(false);
      expect(templateConfig.caseMetadataDeps, template.name).toEqual(
        expect.arrayContaining(["claimant", "defendant"]),
      );
      expect(templateConfig.caseMetadataDeps, template.name).not.toContain(
        "court",
      );
      expect(templateConfig.caseMetadataDeps, template.name).not.toContain(
        "claimNumber",
      );

      const blob = await generateDoc({
        caseMetadata: {
          claimant: "Jane Doe",
          defendant: "Acme Ltd",
        },
        witnessName: "Jane Doe",
        witnessEmail: "jane@example.com",
        witnessMetadata: {
          address: "12 King Street, Manchester",
          occupation: "Warehouse operative",
        },
        sections: Object.fromEntries(
          templateConfig.sections.map((section) => [
            section.id,
            `${section.title} account.`,
          ]),
        ),
        config: templateConfig,
      });
      const text = await extractDocxText(await blob.arrayBuffer());

      expect(text, template.name).toContain("WITNESS STATEMENT OF Jane Doe");
      expect(text, template.name).toContain(
        "I, Jane Doe, of 12 King Street, Manchester, Warehouse operative, will say as follows:",
      );
      expect(text, template.name).toContain("BETWEEN:");
      expect(text, template.name).toContain("STATEMENT OF TRUTH");
      expect(text, template.name).toContain(
        "I believe that the facts stated in this witness statement are true.",
      );
      expect(text, template.name).toContain("Signed:");
      expect(text, template.name).not.toContain("Case Metadata");
      expect(text, template.name).not.toContain("IN THE");
      expect(text, template.name).not.toContain("CLAIM NO");
      for (const section of templateConfig.sections) {
        expect(text, template.name).toContain(section.title);
      }
    }
  });
});
