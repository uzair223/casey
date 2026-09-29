import { describe, expect, it } from "vitest";

import { extractJsonStringField } from "@/lib/llm/json-content";
import { modelWitnessDetails } from "@/lib/llm/witness-details";

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

  it("keeps witness details the model set and drops empty ones", () => {
    expect(
      modelWitnessDetails({ occupation: null, address: "1 High Street" }),
    ).toEqual({ address: "1 High Street" });
  });
});
