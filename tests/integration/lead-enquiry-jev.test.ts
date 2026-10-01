import { describe, expect, it } from "vitest";

import { readJevResult } from "@/lib/llm/jev/client";
import {
  buildEnquiryQuestions,
  enquiryClosesWithoutLead,
  interpretRedirectAnswer,
  mergeEnquiryDecisions,
  rememberDeclinedLeadType,
  silentLeadTypeRoute,
  type EnquiryLeadTypeOption,
} from "@/lib/llm/jev/enquiry-turn";
import { settleEnquiryTurn } from "@/lib/leads/enquiry";
import type { QualificationSlot } from "@/lib/leads/schema";

const accident: EnquiryLeadTypeOption = {
  id: "accident",
  name: "Accident at work",
  channelId: "channel-accident",
};
const clinical: EnquiryLeadTypeOption = {
  id: "clinical",
  name: "Clinical negligence",
  channelId: "channel-clinical",
};
const enabled = [accident, clinical];

const slots: QualificationSlot[] = [
  { id: "name", label: "Your name", type: "text", required: true, reserved: "name" },
  { id: "email", label: "Email", type: "text", reserved: "email" },
  { id: "phone", label: "Phone", type: "text", reserved: "phone" },
];

function decide(
  answers: Record<string, unknown> | null,
  extras: { declinedLeadTypeIds?: string[]; leadTypes?: EnquiryLeadTypeOption[] } = {},
) {
  return mergeEnquiryDecisions({
    answers,
    currentLeadTypeId: accident.id,
    leadTypes: extras.leadTypes ?? enabled,
    declinedLeadTypeIds: extras.declinedLeadTypeIds ?? [],
  });
}

describe("enquiry JEV decisions", () => {
  it("continues when the decision is to keep talking", () => {
    const decision = decide({
      conversationAction: { choice: "continue", confidence: 0.9 },
      disposition: { choice: "send_to_firm", confidence: 0.2 },
      shouldDiscardNow: { noul: 0.1 },
      matchedLeadType: { choice: clinical.id, confidence: 0.2 },
    });

    expect(decision.usedJev).toBe(true);
    expect(decision.action).toBe("continue");
    expect(decision.disposition).toBe("send_to_firm");
    expect(decision.discardNow).toBe(false);
    expect(decision.redirect).toBeNull();
    expect(enquiryClosesWithoutLead(decision)).toBe(false);
  });

  it("routes a confident mismatch without asking the visitor", () => {
    const decision = decide({
      conversationAction: { choice: "end", confidence: 0.91 },
      disposition: { choice: "send_to_firm", confidence: 0.8 },
      shouldDiscardNow: { noul: 0.1 },
      matchedLeadType: { choice: clinical.id, confidence: 0.7 },
    });

    expect(decision.action).toBe("end");
    expect(decision.redirect).toEqual(clinical);
    expect(silentLeadTypeRoute(decision, enabled)).toEqual(clinical);
    expect(enquiryClosesWithoutLead(decision)).toBe(false);
  });

  it("does not offer a lead type the visitor already declined", () => {
    const decision = decide(
      {
        matchedLeadType: { choice: clinical.id, confidence: 0.95 },
      },
      { declinedLeadTypeIds: [clinical.id] },
    );

    expect(decision.redirect).toBeNull();
  });

  it("does not switch on a weak type match", () => {
    const decision = decide({
      matchedLeadType: { choice: clinical.id, confidence: 0.5 },
    });

    expect(decision.redirect).toBeNull();
  });

  it("keeps the selected type when that is still the match", () => {
    const decision = decide({
      matchedLeadType: { choice: accident.id, confidence: 0.92 },
    });

    expect(decision.redirect).toBeNull();
  });

  it("only matches a lead type the firm has enabled", () => {
    const decision = decide({
      matchedLeadType: { choice: "road", confidence: 0.99 },
    });
    const questions = buildEnquiryQuestions(enabled);

    expect(decision.redirect).toBeNull();
    expect(questions.matchedLeadType?.type).toBe("choice");
    if (questions.matchedLeadType?.type === "choice") {
      expect(Object.keys(questions.matchedLeadType.criteria)).toEqual([
        accident.id,
        clinical.id,
      ]);
    }
    expect(buildEnquiryQuestions([accident]).matchedLeadType).toBeUndefined();
  });

  it("sends a finished enquiry only after contact is known", () => {
    const decision = decide({
      conversationAction: { choice: "end", confidence: 0.88 },
      disposition: { choice: "send_to_firm", confidence: 0.86 },
      shouldDiscardNow: { noul: 0.05 },
    });
    const turn = settleEnquiryTurn({
      slots,
      answers: {},
      message: "A pallet fell on my leg at work on 20 May and I broke my tibia.",
      transcript: "A pallet fell on my leg at work on 20 May and I broke my tibia.",
      extraction: null,
      wrapUp: true,
    });

    expect(decision.action).toBe("end");
    expect(decision.disposition).toBe("send_to_firm");
    expect(enquiryClosesWithoutLead(decision)).toBe(false);
    expect(turn.answers.summary).toBeUndefined();
    expect(turn.readyToVerify).toBe(false);
    expect(turn.reply.toLowerCase()).toContain("what happened");
  });

  it("discards an ended enquiry that should not reach the firm", () => {
    const decision = decide({
      conversationAction: { choice: "end", confidence: 0.9 },
      disposition: { choice: "discard", confidence: 0.84 },
      shouldDiscardNow: { noul: 0.2 },
      matchedLeadType: { choice: clinical.id, confidence: 0.4 },
    });

    expect(decision.disposition).toBe("discard");
    expect(decision.redirect).toBeNull();
    expect(enquiryClosesWithoutLead(decision)).toBe(true);
  });

  it("stops immediately on abuse without offering a type switch", () => {
    const decision = decide({
      conversationAction: { choice: "continue", confidence: 0.9 },
      disposition: { choice: "send_to_firm", confidence: 0.9 },
      shouldDiscardNow: { noul: 0.85 },
      matchedLeadType: { choice: clinical.id, confidence: 0.95 },
    });

    expect(decision.discardNow).toBe(true);
    expect(decision.action).toBe("end");
    expect(decision.disposition).toBe("discard");
    expect(decision.redirect).toBeNull();
    expect(enquiryClosesWithoutLead(decision)).toBe(true);
  });

  it("keeps the conversation going when JEV is unavailable", () => {
    const decision = decide(null);

    expect(decision.usedJev).toBe(false);
    expect(decision.action).toBe("continue");
    expect(decision.disposition).toBe("send_to_firm");
    expect(decision.discardNow).toBe(false);
    expect(enquiryClosesWithoutLead(decision)).toBe(false);
  });

  it("reads answers from the gateway envelope", () => {
    const parsed = readJevResult({
      success: true,
      result: {
        state: "Completed",
        result: {
          model: "jev-1.13.0",
          answers: {
            matchedLeadType: { type: "choice", choice: "clinical", confidence: 0.99 },
          },
          usage: { input_tokens: 10, output_tokens: 4 },
        },
      },
    });

    expect(parsed?.answers.matchedLeadType).toMatchObject({
      choice: "clinical",
      confidence: 0.99,
    });
  });

  it("reads a clear yes or no and leaves an ambiguous answer for JEV", () => {
    expect(interpretRedirectAnswer("Yes.")).toBe("yes");
    expect(interpretRedirectAnswer("no thanks")).toBe("no");
    expect(interpretRedirectAnswer("I think it was the hospital")).toBe("unclear");
    const declined = rememberDeclinedLeadType(
      { redirect_lead_type_id: clinical.id, redirect_channel_id: clinical.channelId },
      clinical.id,
    );
    expect(declined.redirect_lead_type_id).toBeUndefined();
    expect(declined.redirect_declined_ids).toBe(clinical.id);
  });
});
