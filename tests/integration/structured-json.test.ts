import { describe, expect, it } from "vitest";

import { unwrapStructuredJson } from "@/lib/llm/responses";

describe("unwrapStructuredJson", () => {
  it("unwraps a single schema-name wrapper", () => {
    expect(
      unwrapStructuredJson(
        { witness_statement: { accidentDescription: "The pallet collapsed." } },
        "witness_statement",
      ),
    ).toEqual({ accidentDescription: "The pallet collapsed." });
  });

  it("leaves unwrapped objects unchanged", () => {
    expect(
      unwrapStructuredJson(
        { accidentDescription: "The pallet collapsed." },
        "witness_statement",
      ),
    ).toEqual({ accidentDescription: "The pallet collapsed." });
  });
});
