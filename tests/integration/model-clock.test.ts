import { describe, expect, it } from "vitest";

import { modelTemporalAwareness, modelToday } from "@/lib/llm/model-clock";

describe("model clock", () => {
  it("states the London date and treats earlier dates as past", () => {
    const now = new Date("2026-09-30T11:00:00Z");

    expect(modelToday(now)).toBe("Wednesday 30 September 2026");
    expect(modelTemporalAwareness(now)).toContain(
      "Today is Wednesday 30 September 2026.",
    );
    expect(modelTemporalAwareness(now)).toContain(
      "Do not describe a fit note, time off, treatment, or other period as still in place",
    );
  });
});
