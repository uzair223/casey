import { describe, expect, it } from "vitest";

import { buildProgrammaticEvidenceSection } from "@/lib/statement-utils";
import type { StatementConfig, StatementSupportingDocument } from "@/types";

const config = {
  phases: [],
  sections: [
    { id: "incident", title: "Incident", description: null },
    {
      id: "supportingEvidence",
      title: "Supporting Evidence",
      description: "Evidence and exhibits relied on by the statement.",
    },
  ],
  witness_metadata_fields: [],
  case_metadata_deps: [],
  prompts: null,
} satisfies StatementConfig;

function documentRow(
  overrides: Partial<StatementSupportingDocument>,
): StatementSupportingDocument {
  return {
    id: "document-1",
    tenant_id: "tenant-1",
    case_id: "case-1",
    statement_id: "statement-1",
    uploaded_by_type: "witness",
    uploaded_by_user_id: null,
    uploaded_by_witness_name: "John Doe",
    uploaded_by_witness_email: "john@example.com",
    title: "Damage photo",
    group_name: "photos",
    document: {
      bucketId: "tenant-1",
      name: "damage.png",
      path: "cases/case-1/statement-1/evidence/photos/damage.png",
      type: "image/png",
      uploadedAt: "2026-04-30T12:00:00.000Z",
      group: "photos",
    },
    descriptor_status: "generated",
    descriptors: {
      summary: "Photograph showing damage to the passenger side.",
      documentType: "Photograph",
      keyDetails: ["Passenger-side damage is visible"],
      concerns: ["No timestamp visible"],
    },
    descriptor_model: "cheap-model",
    descriptor_generated_at: "2026-04-30T12:01:00.000Z",
    created_at: "2026-04-30T12:00:00.000Z",
    updated_at: "2026-04-30T12:01:00.000Z",
    ...overrides,
  };
}

describe("programmatic statement evidence section", () => {
  it("builds exhibit text from supporting document descriptors", () => {
    const section = buildProgrammaticEvidenceSection({
      config,
      witnessName: "John Doe",
      rows: [documentRow({})],
    });

    expect(section?.sectionId).toBe("supportingEvidence");
    expect(section?.content).toContain("Exhibit JD1: photographs");
    expect(section?.content).toContain("Damage photo");
    expect(section?.content).toContain(
      "Photograph showing damage to the passenger side.",
    );
    expect(section?.content).toContain(
      "Key detail: Passenger-side damage is visible.",
    );
    expect(section?.content).toContain("Review point: No timestamp visible.");
  });

  it("uses descriptor type before the original upload group for exhibit numbering", () => {
    const section = buildProgrammaticEvidenceSection({
      config,
      witnessName: "John Doe",
      rows: [
        documentRow({
          group_name: "supporting evidence",
          title: "Repair estimate",
          document: {
            bucketId: "tenant-1",
            name: "repair-estimate.pdf",
            path: "cases/case-1/statement-1/evidence/other/repair-estimate.pdf",
            type: "application/pdf",
            uploadedAt: "2026-04-30T12:00:00.000Z",
            group: "supporting evidence",
          },
          descriptors: {
            summary: "Repair estimate showing vehicle repair costs.",
            documentType: "Repair estimate",
            keyDetails: ["Total repair cost is listed"],
          },
        }),
        documentRow({
          id: "document-2",
          title: "Damage photo",
          descriptors: {
            summary: "Photograph showing vehicle damage.",
            documentType: "Photograph",
          },
        }),
      ],
    });

    expect(section?.content).toContain("Exhibit JD1: repair estimates");
    expect(section?.content).toContain("Exhibit JD2: photographs");
  });
});
