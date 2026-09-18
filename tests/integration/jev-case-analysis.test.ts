import { describe, expect, it } from "vitest";

import {
  applyCaseAnalysisDecisions,
  completenessLevelFromScore,
} from "@/lib/llm/jev/case-analysis";
import type { CaseAnalysis } from "@/lib/schema";

const sourceA = {
  statementId: "statement-1",
  witnessName: "Alex",
  sectionId: "incident",
  excerpt: "The car was red.",
};
const sourceB = {
  statementId: "statement-2",
  witnessName: "Blair",
  sectionId: "incident",
  excerpt: "The car was red.",
};

function draft(overrides: Partial<CaseAnalysis> = {}): CaseAnalysis {
  return {
    executiveSummary: "Two witnesses described the collision.",
    chronology: [
      {
        dateOrTime: "10:00",
        event: "Impact",
        sources: [sourceA, sourceB],
        conflicts: ["One says the light was green; the other says red."],
      },
    ],
    agreedFacts: [
      {
        fact: "The car was red.",
        sources: [sourceA, sourceB],
      },
      {
        fact: "It was raining.",
        sources: [sourceA, sourceB],
      },
    ],
    disputedFacts: [
      {
        issue: "Traffic light colour",
        positions: [
          { summary: "Green", sources: [sourceA] },
          { summary: "Red", sources: [sourceB] },
        ],
        suggestedFollowUps: ["Ask for CCTV."],
      },
      {
        issue: "Whether the radio was on",
        positions: [
          { summary: "Radio was playing", sources: [sourceA] },
          { summary: "Does not mention a radio", sources: [sourceB] },
        ],
        suggestedFollowUps: [],
      },
    ],
    missingInformation: [
      {
        gap: "Speed of the other vehicle",
        whyItMatters: "Needed for liability.",
        suggestedFollowUps: ["Ask for an estimate."],
      },
      {
        gap: "Favourite song on the radio",
        whyItMatters: "Colour.",
        suggestedFollowUps: [],
      },
    ],
    evidenceMentioned: [],
    caseThemes: [],
    ...overrides,
  };
}

describe("Jev case analysis overlay", () => {
  it("maps completeness scores onto named levels", () => {
    expect(completenessLevelFromScore(0.2)).toBe("thin");
    expect(completenessLevelFromScore(1)).toBe("partial");
    expect(completenessLevelFromScore(2.1)).toBe("mostly");
    expect(completenessLevelFromScore(3)).toBe("trial-ready");
  });

  it("keeps genuine contradictions and material gaps, and drops weak ones", () => {
    const overlaid = applyCaseAnalysisDecisions(draft(), {
      overallCompleteness: { type: "score", score: 1.8, confidence: 0.84 },
      agreed_0: { type: "noul", noul: 0.91 },
      agreed_1: { type: "noul", noul: 0.2 },
      disputed_0: { type: "noul", noul: 0.88 },
      disputed_1: { type: "noul", noul: 0.21 },
      gap_0: { type: "noul", noul: 0.8 },
      gap_1: { type: "noul", noul: 0.1 },
      conflict_0_0: { type: "noul", noul: 0.86 },
    });

    expect(overlaid.completeness).toMatchObject({
      level: "mostly",
      score: 1.8,
    });
    expect(overlaid.agreedFacts.map((item) => item.fact)).toEqual([
      "The car was red.",
    ]);
    expect(overlaid.disputedFacts.map((item) => item.issue)).toEqual([
      "Traffic light colour",
    ]);
    expect(overlaid.missingInformation.map((item) => item.gap)).toEqual([
      "Speed of the other vehicle",
    ]);
    expect(overlaid.chronology[0].conflicts).toHaveLength(1);
  });

  it("strips chronology conflicts that are not real", () => {
    const overlaid = applyCaseAnalysisDecisions(draft(), {
      conflict_0_0: { type: "noul", noul: 0.12 },
    });

    expect(overlaid.chronology[0].conflicts).toEqual([]);
  });

  it("leaves uncapped or unanswered items unchanged", () => {
    const overlaid = applyCaseAnalysisDecisions(draft(), {
      overallCompleteness: { type: "score", score: 2, confidence: 0.2 },
    });

    expect(overlaid.completeness).toBeUndefined();
    expect(overlaid.agreedFacts).toHaveLength(2);
    expect(overlaid.disputedFacts).toHaveLength(2);
    expect(overlaid.missingInformation).toHaveLength(2);
  });
});
