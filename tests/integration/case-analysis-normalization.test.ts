import { describe, expect, it } from "vitest";

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
