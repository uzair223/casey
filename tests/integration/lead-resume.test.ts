import { describe, expect, it } from "vitest";

import {
  enquiryResumeUrl,
  enquiryVerificationCode,
  messageLooksLikeEnquiryCode,
} from "@/lib/leads/resume";

describe("enquiry resume", () => {
  it("reads a code on its own or inside the email sentence", () => {
    expect(enquiryVerificationCode("164804")).toBe("164804");
    expect(enquiryVerificationCode("I just received a code from you: 164804")).toBe(
      "164804",
    );
    expect(enquiryVerificationCode("codes 164804 and 225511")).toBeNull();
    expect(enquiryVerificationCode("A pallet fell on my leg")).toBeNull();
  });

  it("recognises a message that is about a confirmation code", () => {
    expect(messageLooksLikeEnquiryCode("I just received a code from you: 164804")).toBe(
      true,
    );
    expect(messageLooksLikeEnquiryCode("164804")).toBe(false);
    expect(messageLooksLikeEnquiryCode("A pallet fell on my leg")).toBe(false);
  });

  it("builds a link back to the same chat", () => {
    expect(enquiryResumeUrl({ slug: "demo", token: "abc123" })).toMatch(
      /\/q\/demo\?session=abc123$/,
    );
  });
});