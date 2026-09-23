import { describe, expect, it } from "vitest";

import { generateDoc } from "@/lib/doc-gen";
import { extractDocxText } from "@/lib/files";
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
    expect(text).toContain("Accident Description");
    expect(text).toContain("Exhibit JD1: photos of the collapsed pallet.");
    expect(text).not.toMatch(/\bundefined\b/);
  });
});
