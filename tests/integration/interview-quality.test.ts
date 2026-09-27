import { describe, expect, it } from "vitest";

import { extractJsonStringField } from "@/lib/llm/json-content";
import {
  mergeWitnessDetailPatch,
  statedWitnessDetails,
} from "@/lib/llm/witness-details";

describe("interview quality helpers", () => {
  it("streams a JSON content field without parsing the rest of the object", () => {
    expect(extractJsonStringField('{"content":"Hi', "content")).toBe("Hi");
    expect(
      extractJsonStringField(
        '{"content":"Line one\\nLine two","metadata":{"progress":{}}}',
        "content",
      ),
    ).toBe("Line one\nLine two");
  });

  it("records a stated occupation and does not let a later null wipe it", () => {
    expect(
      statedWitnessDetails({
        userMessage: "I'm a courier and at the time I was loading the car",
        fieldIds: ["address", "occupation"],
        existing: {},
      }),
    ).toEqual({ occupation: "courier" });

    expect(
      mergeWitnessDetailPatch(
        { occupation: null, address: "1 High Street" },
        { occupation: "courier" },
      ),
    ).toEqual({ occupation: "courier", address: "1 High Street" });
  });
});
