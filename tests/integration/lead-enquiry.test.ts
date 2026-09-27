import { describe, expect, it } from "vitest";

import {
  parseEnquiryJson,
  sanitizeEnquirySummary,
  settleEnquiryTurn,
} from "@/lib/leads/enquiry";
import {
  redactCaseForFirm,
  REDACTED_CONTACT,
  REDACTED_LEAD_NAME,
} from "@/lib/leads/privacy";
import type { QualificationSlot } from "@/lib/leads/schema";
import type { CaseStatementJoin } from "@/types";

const slots: QualificationSlot[] = [
  { id: "name", label: "Your name", type: "text", required: true, reserved: "name" },
  { id: "email", label: "Email", type: "text", reserved: "email" },
  { id: "phone", label: "Phone", type: "text", reserved: "phone" },
  { id: "what", label: "What happened", type: "long_text", required: true },
];

const overview =
  "The lead was injured in a workplace incident on the 20th of May. A pallet dropped on their leg, resulting in a broken tibia and the lead being out of work for 2 months as a result.";

describe("enquiry conversation", () => {
  it("follows the incident instead of asking for a name", () => {
    const turn = settleEnquiryTurn({
      slots,
      answers: {},
      message: "A pallet dropped on my leg",
      extraction: {
        reply: "Your name?",
        overviewReady: false,
        summary: null,
        name: null,
        email: null,
        phone: null,
      },
    });

    expect(turn.reply.toLowerCase()).not.toContain("your name");
    expect(turn.reply.toLowerCase()).toContain("what happened");
    expect(turn.readyToVerify).toBe(false);
    expect(turn.answers.name).toBeUndefined();
  });

  it("keeps the person's name out of the firm overview", () => {
    const turn = settleEnquiryTurn({
      slots,
      answers: {},
      message:
        "On 20 May a pallet dropped on my leg. I broke my tibia and was off work for two months.",
      extraction: {
        reply: "Thanks, that is enough to pass on.",
        overviewReady: true,
        summary: overview.replace("The lead was", "Uzair was"),
        name: "Uzair",
        email: null,
        phone: null,
      },
    });

    expect(turn.answers.summary).toContain("The lead was injured");
    expect(turn.answers.summary?.toLowerCase()).not.toContain("uzair");
    expect(turn.answers.name).toBeUndefined();
    expect(turn.reply.toLowerCase()).toMatch(/reach|email|phone|name/);
    expect(turn.readyToVerify).toBe(false);
  });

  it("asks for a full name when only a first name and an email are known", () => {
    const turn = settleEnquiryTurn({
      slots,
      answers: { summary: overview },
      message: "Uzair, uzair@example.com",
      extraction: {
        reply: "Thanks.",
        overviewReady: true,
        summary: `Uzair was mentioned. ${overview}`,
        name: "Uzair",
        email: "uzair@example.com",
        phone: null,
      },
    });

    expect(turn.answers.name).toBe("Uzair");
    expect(turn.answers.email).toBe("uzair@example.com");
    expect(turn.answers.summary?.toLowerCase()).not.toContain("uzair");
    expect(turn.readyToVerify).toBe(false);
    expect(turn.reply.toLowerCase()).toContain("full name");
  });

  it("asks for a code once the overview, full name, and contact are known", () => {
    const turn = settleEnquiryTurn({
      slots,
      answers: { summary: overview, name: "Uzair" },
      message: "Uzair Patel, uzair@example.com",
      extraction: {
        reply: "Thanks.",
        overviewReady: true,
        summary: `Uzair Patel was mentioned. ${overview}`,
        name: "Uzair Patel",
        email: "uzair@example.com",
        phone: null,
      },
    });

    expect(turn.answers.name).toBe("Uzair Patel");
    expect(turn.answers.email).toBe("uzair@example.com");
    expect(turn.readyToVerify).toBe(true);
    expect(turn.reply.toLowerCase()).toContain("emailed");
    expect(turn.reply.toLowerCase()).toContain("junk");
  });

  it("parses a fenced model reply", () => {
    const parsed = parseEnquiryJson(
      '```json\n{"reply":"What followed?","overviewReady":false,"summary":null,"name":null,"email":null,"phone":null}\n```',
    );
    expect(parsed?.reply).toBe("What followed?");
    expect(parsed?.overviewReady).toBe(false);
  });

  it("strips contact details from a summary", () => {
    const summary = sanitizeEnquirySummary(
      "Uzair (uzair@example.com, 07700900123) was off work.",
      { name: "Uzair", email: "uzair@example.com", phone: "07700900123" },
    );
    expect(summary.toLowerCase()).not.toContain("uzair");
    expect(summary).not.toContain("@");
    expect(summary).not.toContain("07700");
  });
});

function lead(stage: string): CaseStatementJoin {
  return {
    id: "case-1",
    title: "Uzair — Accident at work",
    case_template_name: "Accident at work",
    case_metadata: {
      summary: overview,
      name: "Uzair",
      email: "uzair@example.com",
    },
    statements: [
      {
        id: "statement-1",
        status: "draft",
        witness_name: "Uzair",
        witness_email: "uzair@example.com",
        updated_at: "2026-05-20T00:00:00.000Z",
        participant_kind: "primary",
        role_key: "claimant",
        lead_stage: stage,
        contact_email: "uzair@example.com",
        contact_phone: "07700900123",
        outreach_confirmed_at: null,
        parent_statement_id: null,
      },
    ],
  } as unknown as CaseStatementJoin;
}

describe("lead contact redaction", () => {
  it("hides name and email until the lead is accepted", () => {
    const hidden = redactCaseForFirm(lead("new"));
    expect(hidden.title).toBe("Accident at work");
    expect(hidden.statements[0]?.witness_name).toBe(REDACTED_LEAD_NAME);
    expect(hidden.statements[0]?.witness_email).toBe(REDACTED_CONTACT);
    expect(hidden.statements[0]?.contact_email).toBeNull();
    expect(hidden.statements[0]?.contact_phone).toBeNull();
    expect(hidden.case_metadata.summary).toContain("The lead was injured");
    expect(hidden.case_metadata.name).toBeUndefined();
    expect(hidden.case_metadata.email).toBeUndefined();
  });

  it("keeps a declined lead hidden", () => {
    const hidden = redactCaseForFirm(lead("declined"));
    expect(hidden.statements[0]?.witness_email).toBe(REDACTED_CONTACT);
  });

  it("shows contact after the lead is accepted", () => {
    const shown = redactCaseForFirm(lead("intake"));
    expect(shown.title).toBe("Uzair — Accident at work");
    expect(shown.statements[0]?.witness_name).toBe("Uzair");
    expect(shown.statements[0]?.witness_email).toBe("uzair@example.com");
  });
});
