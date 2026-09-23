import { describe, expect, it } from "vitest";

import { defaultMeta } from "@/lib/statement-utils";
import type { StatementConfig } from "@/types";
import {
  mergeIntakeTurnDecisions,
  overlayJevControlMetadata,
  scoreToPercent,
} from "@/lib/llm/jev/interview-turn";

const statementConfig = {
  schemaVersion: 4,
  modelIdentity: "You are interviewing the witness of a road traffic collision.",
  phases: [
    {
      id: "incidentFacts",
      title: "Incident facts",
      objective: "Core incident facts",
      allowedTopics: null,
      forbiddenTopics: null,
      completionCriteria: ["What happened", "Where it happened"],
      questioningMode: "mixed" as const,
    },
    {
      id: "injuries",
      title: "Injuries",
      objective: "Injury and treatment",
      allowedTopics: null,
      forbiddenTopics: null,
      completionCriteria: ["Injuries described"],
      questioningMode: "structured" as const,
    },
  ],
  sections: [],
  witnessMetadataFields: [],
  caseMetadataDeps: [],
} satisfies StatementConfig;

function answers(overrides: Record<string, unknown> = {}) {
  return {
    turnKind: {
      type: "choice",
      choice: "on_topic",
      confidence: 0.9,
    },
    currentPhase: {
      type: "choice",
      choice: "incidentFacts",
      confidence: 0.88,
    },
    phaseCompleteness: {
      type: "score",
      score: 2,
      confidence: 0.8,
    },
    readyToPrepare: { type: "noul", noul: 0.2 },
    isJailbreak: { type: "noul", noul: 0.02 },
    shouldStopNow: { type: "noul", noul: 0.01 },
    ...overrides,
  };
}

describe("Jev intake turn merge", () => {
  it("maps a phase completeness score onto the current phase", () => {
    const merged = mergeIntakeTurnDecisions({
      previousMetadata: defaultMeta(statementConfig),
      statementConfig,
      answers: answers(),
    });

    expect(scoreToPercent(2)).toBe(67);
    expect(merged.progress.currentPhase).toBe("incidentFacts");
    expect(merged.progress.phaseCompleteness.incidentFacts).toBe(67);
    expect(merged.progress.readyToPrepare).toBe(false);
    expect(merged.deviation).toBeNull();
  });

  it("flags a first off-topic turn without stopping the intake", () => {
    const merged = mergeIntakeTurnDecisions({
      previousMetadata: defaultMeta(statementConfig),
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "off_topic",
          confidence: 0.92,
        },
      }),
    });

    expect(merged.deviation).toMatchObject({
      flaggedDeviation: true,
      stopIntake: false,
      consecutiveDeviationCount: 1,
    });
  });

  it("increments consecutive deviations and stops at three", () => {
    const first = mergeIntakeTurnDecisions({
      previousMetadata: defaultMeta(statementConfig),
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "off_topic",
          confidence: 0.95,
        },
      }),
    });
    const second = mergeIntakeTurnDecisions({
      previousMetadata: first,
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "legal_advice_request",
          confidence: 0.9,
        },
      }),
    });
    const third = mergeIntakeTurnDecisions({
      previousMetadata: second,
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "off_topic",
          confidence: 0.91,
        },
      }),
    });

    expect(second.deviation?.consecutiveDeviationCount).toBe(2);
    expect(second.deviation?.stopIntake).toBe(false);
    expect(third.deviation).toMatchObject({
      consecutiveDeviationCount: 3,
      stopIntake: true,
    });
  });

  it("stops immediately on a high-confidence jailbreak", () => {
    const merged = mergeIntakeTurnDecisions({
      previousMetadata: defaultMeta(statementConfig),
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "on_topic",
          confidence: 0.4,
        },
        isJailbreak: { type: "noul", noul: 0.91 },
      }),
    });

    expect(merged.deviation?.stopIntake).toBe(true);
    expect(merged.progress.readyToPrepare).toBe(false);
  });

  it("clears deviation when the witness returns to case facts", () => {
    const flagged = mergeIntakeTurnDecisions({
      previousMetadata: defaultMeta(statementConfig),
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "off_topic",
          confidence: 0.9,
        },
      }),
    });
    const recovered = mergeIntakeTurnDecisions({
      previousMetadata: flagged,
      statementConfig,
      answers: answers(),
    });

    expect(flagged.deviation?.flaggedDeviation).toBe(true);
    expect(recovered.deviation).toBeNull();
  });

  it("keeps the previous phase when the choice is low confidence", () => {
    const previous = defaultMeta(statementConfig);
    previous.progress.currentPhase = "injuries";
    previous.progress.phaseCompleteness.injuries = 40;

    const merged = mergeIntakeTurnDecisions({
      previousMetadata: previous,
      statementConfig,
      answers: answers({
        currentPhase: {
          type: "choice",
          choice: "incidentFacts",
          confidence: 0.2,
        },
        phaseCompleteness: {
          type: "score",
          score: 3,
          confidence: 0.1,
        },
      }),
    });

    expect(merged.progress.currentPhase).toBe("injuries");
    expect(merged.progress.phaseCompleteness.injuries).toBe(40);
  });

  it("overlays Jev progress and deviation onto LLM metadata", () => {
    const llm = defaultMeta(statementConfig);
    llm.progress.currentPhase = "injuries";
    llm.witnessDetails = { occupation: "driver" };

    const jev = mergeIntakeTurnDecisions({
      previousMetadata: defaultMeta(statementConfig),
      statementConfig,
      answers: answers({
        turnKind: {
          type: "choice",
          choice: "off_topic",
          confidence: 0.93,
        },
      }),
    });

    const overlaid = overlayJevControlMetadata(llm, jev);
    expect(overlaid.witnessDetails).toEqual({ occupation: "driver" });
    expect(overlaid.progress.currentPhase).toBe("incidentFacts");
    expect(overlaid.deviation?.flaggedDeviation).toBe(true);
  });
});
