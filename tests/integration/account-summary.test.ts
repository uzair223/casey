import { describe, expect, it } from "vitest";

import {
  documentDraftingEnabled,
  readAccountSummary,
  retainSignedStatement,
} from "@/lib/statements/document-flow";

describe("account summary", () => {
  it("reads the narrative stored beside the formalized sections", () => {
    expect(readAccountSummary({ summary: "  A pallet fell on their foot. " })).toBe(
      "A pallet fell on their foot.",
    );
    expect(readAccountSummary({ accountSummary: "They were hurt at work." })).toBe(
      "They were hurt at work.",
    );
    expect(readAccountSummary({ sections: { intro: "Hello" } })).toBe("");
    expect(readAccountSummary(null)).toBe("");
  });

  it("keeps document drafting off the path a firm or lead uses", () => {
    expect(documentDraftingEnabled()).toBe(false);
    expect(retainSignedStatement("submitted")).toBe(false);
    expect(retainSignedStatement("finalized")).toBe(true);
    expect(retainSignedStatement("completed")).toBe(true);
  });
});
