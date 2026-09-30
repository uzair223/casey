import { describe, expect, it } from "vitest";

import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import { generateGreeting, witnessFacingEnquiry } from "@/lib/llm/prompts";
import { spokenSoFar } from "@/lib/llm/second-person";

describe("account greeting fallback", () => {
  it("speaks the matter naturally and leaves the firm's draft out", () => {
    const [greeting, question] = generateGreeting(
      { title: "Uzair — Accident at work" },
      {
        witness_name: "Uzair Patel",
        witness_metadata: {},
        statement_config: {
          ...EMPTY_STATEMENT_CONFIG,
          witnessMetadataFields: [
            {
              id: "address",
              label: "Address",
              description: null,
              requiredOnIntake: true,
              requiredOnCreate: false,
            },
          ],
        },
      },
    );

    expect(greeting?.content).toBe(
      "Hi Uzair, I'm here to take your full account for your accident at work.",
    );
    expect(greeting?.content).not.toMatch(/draft|review|firm/i);
    expect(question?.content).toBe(
      "To begin, could you please provide your address?",
    );
  });

  it("restates the firm overview as you", () => {
    expect(
      witnessFacingEnquiry(
        "The lead is a courier who hurt their foot when a parcel fell.",
      ),
    ).toBe(
      "You told us you are a courier who hurt your foot when a parcel fell.",
    );
    expect(spokenSoFar("The lea")).toBe("");
    expect(spokenSoFar("The lead is a courier")).toBe("You are a courier");
  });
});
