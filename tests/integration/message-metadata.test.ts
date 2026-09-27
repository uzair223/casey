import { describe, expect, it } from "vitest";

import type { IntakeChatMessage } from "@/types";
import {
  EMPTY_STATEMENT_CONFIG,
  defaultMeta,
  getLastMeta,
  getLastProgress,
  getMessageResponseMeta,
  preservePhaseHighWater,
} from "@/lib/statement-utils";

const statementConfig = {
  ...EMPTY_STATEMENT_CONFIG,
  phases: [
    {
      id: "incidentFacts",
      title: "Incident facts",
      objective: "Core incident facts",
      allowedTopics: null,
      forbiddenTopics: null,
      completionCriteria: null,
      questioningMode: "mixed" as const,
    },
  ],
};

describe("message metadata helpers", () => {
  it("ignores non-response assistant metadata when resolving previous state", () => {
    const assistantMeta = {
      ...defaultMeta(statementConfig),
      progress: {
        currentPhase: "incidentFacts",
        overallCompletion: 35,
        phaseCompleteness: {
          incidentFacts: 35,
        },
        readyToPrepare: false,
      },
    };

    const history: IntakeChatMessage[] = [
      {
        role: "assistant",
        content: "What happened?",
        meta: assistantMeta,
      },
      {
        role: "assistant",
        content: "Please check the follow-up link.",
        meta: {
          followUpRequest: true,
          requestedAt: "2026-04-23T10:00:00.000Z",
        },
      },
      {
        role: "user",
        content: "Uploaded files",
        meta: {
          attachedFiles: [{ name: "photo.jpg", type: "image/jpeg", size: 123 }],
        },
      },
    ];

    expect(getMessageResponseMeta(history[1], statementConfig)).toBeNull();
    expect(getMessageResponseMeta(history[2], statementConfig)).toBeNull();
    expect(getLastMeta(history, statementConfig)).toEqual(assistantMeta);
    expect(getLastProgress(history, statementConfig)).toEqual(
      assistantMeta.progress,
    );
  });

  it("keeps the highest percent a phase has reached", () => {
    const earlier = {
      ...defaultMeta(statementConfig),
      progress: {
        currentPhase: "incidentFacts",
        overallCompletion: 77,
        phaseCompleteness: { incidentFacts: 77 },
        readyToPrepare: false,
      },
    };
    const later = {
      ...defaultMeta(statementConfig),
      progress: {
        currentPhase: "incidentFacts",
        overallCompletion: 0,
        phaseCompleteness: { incidentFacts: 0 },
        readyToPrepare: false,
      },
    };
    const history: IntakeChatMessage[] = [
      { role: "assistant", content: "Earlier", meta: earlier },
      { role: "assistant", content: "Later", meta: later },
    ];

    const preserved = preservePhaseHighWater(later, history, statementConfig);
    expect(preserved.progress.phaseCompleteness.incidentFacts).toBe(77);
    expect(preserved.progress.overallCompletion).toBe(77);
  });
});
