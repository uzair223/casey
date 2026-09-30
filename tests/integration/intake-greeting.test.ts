import { describe, expect, it } from "vitest";

import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import { generateGreeting, witnessFacingEnquiry } from "@/lib/llm/prompts";
import { spokenSoFar } from "@/lib/llm/second-person";
import {
  addressStillUnasked,
  declinedToGiveAddress,
  statedOccupation,
} from "@/lib/llm/witness-details";
import type { StatementConfig } from "@/types";

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

  it("asks for a missing address before the account phases", () => {
    const statementConfig: StatementConfig = {
      ...EMPTY_STATEMENT_CONFIG,
      phases: [
        {
          id: "collision",
          title: "The collision",
          objective: "How the vehicles came into contact.",
          allowedTopics: null,
          forbiddenTopics: null,
          completionCriteria: ["Point of impact"],
          questioningMode: "narrative",
        },
      ],
      witnessMetadataFields: [
        {
          id: "address",
          label: "Address",
          description: null,
          requiredOnIntake: true,
          requiredOnCreate: false,
        },
        {
          id: "occupation",
          label: "Occupation",
          description: null,
          requiredOnIntake: false,
          requiredOnCreate: false,
        },
      ],
    };
    const [, question] = generateGreeting(
      { title: "Uzair — Accident at work" },
      {
        witness_name: "Uzair Patel",
        witness_metadata: {},
        statement_config: statementConfig,
      },
    );

    expect(question?.content).toBe("What is your address?");
  });

  it("starts the account once an address has been given", () => {
    const [, question] = generateGreeting(
      { title: "Uzair — Accident at work" },
      {
        witness_name: "Uzair Patel",
        witness_metadata: { address: "12 King Street, Blackburn" },
        statement_config: {
          ...EMPTY_STATEMENT_CONFIG,
          phases: [
            {
              id: "collision",
              title: "The collision",
              objective: "How the vehicles came into contact.",
              allowedTopics: null,
              forbiddenTopics: null,
              completionCriteria: ["Point of impact"],
              questioningMode: "narrative",
            },
          ],
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

    expect(question?.content).toBe("Could you tell me about the collision?");
  });
});

describe("address and occupation capture", () => {
  const config: StatementConfig = {
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
  };

  it("keeps the account open until the address is asked", () => {
    expect(
      addressStillUnasked({
        config,
        witnessMetadata: {},
        ignoredMissingDetails: [],
      }),
    ).toBe(true);
    expect(
      addressStillUnasked({
        config,
        witnessMetadata: { address: "12 King Street" },
        ignoredMissingDetails: [],
      }),
    ).toBe(false);
    expect(
      addressStillUnasked({
        config,
        witnessMetadata: {},
        ignoredMissingDetails: ["address"],
      }),
    ).toBe(false);
  });

  it("records a refusal to give an address and keeps a street address", () => {
    expect(
      declinedToGiveAddress(
        "What is your address?",
        "I'd rather not give that.",
      ),
    ).toBe(true);
    expect(
      declinedToGiveAddress(
        "What is your address?",
        "12 King Street, Blackburn",
      ),
    ).toBe(false);
  });

  it("reads a short occupation from the statement draft", () => {
    expect(statedOccupation({ occupation: " courier " })).toBe("courier");
    expect(statedOccupation({ occupation: null })).toBe("");
    expect(statedOccupation({ introduction: "I am a courier" })).toBe("");
  });
});
