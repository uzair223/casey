import { describe, expect, it } from "vitest";

import { generateGreeting } from "@/lib/llm/prompts";
import { EMPTY_STATEMENT_CONFIG } from "@/lib/statement-utils";
import {
  accountGaps,
  isClearerCaseFact,
  leadFactsFromEnquiry,
  questionForAccountGaps,
  spokenDateIn,
  statedCaseDetails,
} from "@/lib/leads/case-facts";

const workFields = [
  { id: "claimant", label: "Claimant", type: "text" as const },
  { id: "defendant", label: "Defendant employer", type: "text" as const },
  { id: "accidentDate", label: "Accident date", type: "date" as const },
  { id: "workplace", label: "Workplace", type: "text" as const },
];

describe("lead facts from an enquiry", () => {
  it("fills the claimant and a spoken date without inventing a year", () => {
    expect(
      spokenDateIn(
        "The lead fractured their foot when a pallet fell on it at work on 8 September.",
      ),
    ).toBe("8 September");

    expect(
      leadFactsFromEnquiry({
        fields: workFields,
        name: "Uzair",
        summary:
          "The lead fractured their foot when a pallet fell on it at work on 8 September.",
      }),
    ).toEqual({
      claimant: "Uzair",
      accidentDate: "8 September",
    });
  });

  it("saves an employer and a depot named in the account", () => {
    expect(
      statedCaseDetails(
        "I'm a courier at Evri. Loose packages fell on my foot at the Evri Blackburn depot.",
        ["defendant", "workplace", "accidentDate"],
      ),
    ).toEqual({
      defendant: "Evri",
      workplace: "Evri Blackburn depot",
    });
  });

  it("keeps a solicitor's value unless the new one is a clearer version", () => {
    expect(isClearerCaseFact("Uzair", "Uzair Patel")).toBe(true);
    expect(isClearerCaseFact("Uzair Patel", "Uzair")).toBe(false);
    expect(isClearerCaseFact("8 September", "8 September 2026 at 2pm")).toBe(
      true,
    );
    expect(isClearerCaseFact("Mill Lane depot", "Acme Logistics")).toBe(false);
    expect(isClearerCaseFact("Mill Lane depot", "")).toBe(false);
  });

  it("asks the detailed account for what the enquiry left open", () => {
    const question = questionForAccountGaps(
      accountGaps([
        {
          id: "claimant",
          label: "Claimant",
          value: "Uzair",
          description: null,
          type: "text",
        },
        {
          id: "defendant",
          label: "Defendant employer",
          value: null,
          description: null,
          type: "text",
        },
        {
          id: "accidentDate",
          label: "Accident date",
          value: "8 September",
          description: null,
          type: "date",
        },
        {
          id: "workplace",
          label: "Workplace",
          value: null,
          description: null,
          type: "text",
        },
      ]),
    );

    expect(question).toBe(
      "Could you tell me your full name, the defendant employer, the year and the time of day and the workplace?",
    );
  });

  it("opens on the first phase and restates the enquiry", () => {
    const [greeting, question] = generateGreeting(
      { title: "Uzair — Accident at work" },
      {
        witness_name: "Uzair",
        witness_metadata: {},
        statement_config: {
          ...EMPTY_STATEMENT_CONFIG,
          phases: [
            {
              id: "theJob",
              title: "The job",
              objective: "The work they were doing.",
              allowedTopics: null,
              forbiddenTopics: null,
              completionCriteria: ["Role and duties"],
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
      {
        enquirySummary:
          "The lead was injured at work on 3 September 2026 when loose packages fell on their foot.",
      },
    );

    expect(greeting?.content).toContain(
      "Hi Uzair, I'm here to take your full account for your accident at work.",
    );
    expect(greeting?.content).toContain(
      "You told us you were injured at work on 3 September 2026 when loose packages fell on your foot.",
    );
    expect(greeting?.content).toContain("We'll go through the job.");
    expect(greeting?.content).not.toMatch(/defendant/i);
    expect(question?.content).toBe("Could you tell me about the job?");
  });
});
