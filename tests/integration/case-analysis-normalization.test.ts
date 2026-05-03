import { describe, expect, it } from "vitest";

import { buildEvidenceCorpus } from "@/lib/ai-workers/case-analysis";
import { normalizeCaseAnalysis } from "@/lib/case-analysis/normalize";
import type { CaseAnalysis } from "@/lib/schema";

const source = {
  statementId: "statement-1",
  witnessName: "John Doe",
  sectionId: "incident",
  excerpt: "Mr Doe's vehicle is a BMW 5 Series.",
};

describe("case analysis normalization", () => {
  it("deduplicates repeated source refs and removes single-statement agreed facts", () => {
    const analysis: CaseAnalysis = {
      executiveSummary: "One statement was analysed.",
      chronology: [
        {
          dateOrTime: null,
          event: "Collision described",
          sources: [source, { ...source }],
          conflicts: [],
        },
      ],
      agreedFacts: [
        {
          fact: "Mr Doe's vehicle is a BMW 5 Series.",
          sources: [source, { ...source }],
        },
      ],
      disputedFacts: [
        {
          issue: "Damage location",
          positions: [
            {
              summary: "The statement refers to passenger-side damage.",
              sources: [source, { ...source }],
            },
          ],
          suggestedFollowUps: [],
        },
      ],
      missingInformation: [],
      evidenceMentioned: [
        {
          evidence: "Repair estimate",
          mentionedBy: [source, { ...source }],
          uploadedOrAvailable: true,
        },
      ],
      caseThemes: [],
    };

    const normalized = normalizeCaseAnalysis(analysis);

    expect(normalized.agreedFacts).toEqual([]);
    expect(normalized.chronology[0].sources).toHaveLength(1);
    expect(normalized.disputedFacts[0].positions[0].sources).toHaveLength(1);
    expect(normalized.evidenceMentioned[0].mentionedBy).toHaveLength(1);
  });
});

describe("case analysis evidence corpus", () => {
  it("includes supporting document descriptors for metadata-only evidence", () => {
    const corpus = buildEvidenceCorpus([
      {
        statementId: "statement-1",
        witnessName: "John Doe",
        documentId: "document-1",
        documentTitle: "Accident scene photo",
        documentName: "scene.png",
        exhibitId: "JD1",
        exhibitDescription: "photos of the accident damage",
        groupName: "photos of the accident damage",
        documentType: "image/png",
        uploadedByType: "witness",
        uploadedByUserId: null,
        uploadedByWitnessName: "John Doe",
        uploadedByWitnessEmail: "john@example.com",
        descriptorStatus: "generated",
        descriptorModel: "cheap-model",
        descriptorGeneratedAt: "2026-04-30T12:00:00.000Z",
        descriptors: {
          summary: "Photo uploaded by the witness showing vehicle damage.",
          documentType: "Photograph",
          keyDetails: ["BMW visible", "front passenger-side damage"],
          concerns: ["No timestamp visible"],
        },
        handledAs: "metadata_only",
        text: null,
      },
    ]);

    expect(corpus).toContain("documentId: document-1");
    expect(corpus).toContain("descriptorSummary: Photo uploaded by the witness");
    expect(corpus).toContain("descriptorDocumentType: Photograph");
    expect(corpus).toContain("front passenger-side damage");
    expect(corpus).toContain("descriptor fields");
  });
});
