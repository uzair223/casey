import { describe, expect, it } from "vitest";

import {
  brandingKeepingWelcome,
  defaultLeadWelcome,
  resolveLeadWelcome,
} from "@/lib/leads/schema";

describe("lead welcome lines", () => {
  it("gives each seeded lead type its own opening", () => {
    expect(defaultLeadWelcome("Road Traffic Accident")).toContain("collision");
    expect(defaultLeadWelcome("Employer Liability")).toContain("accident at work");
    expect(defaultLeadWelcome("Public Liability")).toContain("the place like");
    expect(defaultLeadWelcome("Clinical Negligence")).toContain("treatment");
    expect(defaultLeadWelcome("Housing Disrepair")).toContain("the home");
    expect(defaultLeadWelcome("Employer Liability")).not.toContain(
      "Tell us what happened",
    );
  });

  it("uses a saved line for that lead type, then the default", () => {
    expect(
      resolveLeadWelcome({
        leadTypeName: "Employer Liability",
        leadTypeWelcome: "Tell us about your shift.",
      }),
    ).toBe("Tell us about your shift.");
    expect(
      resolveLeadWelcome({
        leadTypeName: "Employer Liability",
        leadTypeWelcome: "  ",
      }),
    ).toBe(defaultLeadWelcome("Employer Liability"));
  });

  it("keeps each channel's welcome when the firm branding is saved", () => {
    expect(
      brandingKeepingWelcome(
        { primaryColor: "#112233", welcome: "One line for every lead" },
        { welcome: "Tell us about the accident at work." },
      ),
    ).toEqual({
      primaryColor: "#112233",
      welcome: "Tell us about the accident at work.",
    });
  });
});
