import Link from "next/link";
import { Fragment } from "react";

import { ArrowRight, Check } from "@/components/icons";
import { HeroGlow } from "@/components/marketing/hero-glow";
import {
  AboutInterviewVisual,
  SourcesMergeAnimation,
} from "@/components/marketing/about-visual";
import { CtaPair } from "@/components/marketing/cta-pair";
import { MarketingHeading } from "@/components/marketing/heading";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection, MarketingShell } from "@/components/marketing/shell";
import { WaitlistSignupForm } from "@/components/waitlist/waitlist-form";
import { env } from "@/lib/env";

const steps = [
  {
    title: "Qualify the enquiry",
    body: "A short chat on your hosted page, or on Growth the website widget, collects the contact and what happened.",
  },
  {
    title: "Accept the lead",
    body: "The enquiry lands on the firm feed. Accept it, and Casey asks for the fuller account, the evidence, and anyone else involved.",
  },
  {
    title: "Find what's missing before review",
    body: "Missing dates, unsupported detail and conflicting accounts show up on the gap list before a solicitor sits down.",
  },
  {
    title: "Give solicitors more time for their best thinking",
    body: "Review starts from the account. Solicitors prepare the written draft, with the evidence and the gaps in view.",
  },
] as const;

const deeperLinks = [
  {
    label: "Platform",
    title: "Ask. Gather. Find the gaps. Draft.",
    body: "See how interviews, evidence, first drafts and gaps stay in one place, from the intake link to review.",
    href: "/platform",
  },
  {
    label: "Security",
    title: "Built for sensitive files",
    body: "Private account links, e-signatures, and an audit trail you can explain to a practice manager.",
    href: "/legal/security",
  },
  {
    label: "Early access",
    title: "Bring a live matter",
    body: "Show us a matter. We will show where Casey takes that work off your solicitors.",
    href: "/#early-access",
  },
] as const;

const pricingPlans = [
  { name: "Trial", amount: "Free", unit: "" },
  { name: "Starter", amount: "£149", unit: "/month" },
  { name: "Growth", amount: "£349", unit: "/month" },
] as const;

const pricingGroups = [
  {
    label: "Allowance",
    rows: [
      { label: "People included", cells: ["Up to five", "Five", "Fifteen"] },
      {
        label: "Accepted leads",
        cells: ["Three", "Forty per month", "One hundred and twenty per month"],
      },
      {
        label: "Supporting accounts",
        cells: ["Included", "Included", "Included"],
      },
      { label: "Additional accepted lead", cells: ["—", "£15", "£15"] },
      { label: "Hosted enquiry page", cells: ["Included", "Included", "Included"] },
      { label: "Website widget", cells: ["—", "—", "Included"] },
      { label: "Branding", cells: ["—", "—", "Included"] },
      { label: "Text message outreach", cells: ["—", "—", "Included"] },
    ],
  },
  {
    label: "After accept",
    rows: [
      "Account interviews",
      "Follow-up questions",
      "Supporting documents",
      "Written draft during review",
      "Markup and review",
    ].map((label) => ({
      label,
      cells: ["Included", "Included", "Included"] as const,
    })),
  },
  {
    label: "Templates",
    rows: ["Lead type creation", "Account template creation"].map(
      (label) => ({
        label,
        cells: ["—", "Included", "Included"] as const,
      }),
    ),
  },
  {
    label: "AI",
    rows: [
      "Facts and gaps",
      "AI document review",
      "Evidence descriptions",
      "AI template drafting",
    ].map((label) => ({
      label,
      cells: ["—", "Included", "Included"] as const,
    })),
  },
  {
    label: "Record",
    rows: [
      "Activity trail",
      "Signature certificates",
      "Notes",
      "Reminders",
    ].map((label) => ({
      label,
      cells: ["Included", "Included", "Included"] as const,
    })),
  },
] as const;

export default function Home() {
  return (
    <div className="marketing-grain relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
      <section className="relative pb-8 pt-16 lg:pt-28">
        <HeroGlow />
        <MarketingShell className="relative">
          <Reveal eager>
            <h1 className="max-w-[11ch] font-display text-5xl font-normal leading-[1.05] text-primary sm:text-7xl lg:text-[92px]">
              New enquiries without the chasing.
            </h1>
            <svg
              viewBox="0 0 220 16"
              className="mt-3 h-4 w-40 text-brand"
              aria-hidden
            >
              <path
                d="M2 10 C 40 4, 70 14, 110 8 S 180 12, 218 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Reveal>
          <Reveal eager>
            <p className="mt-8 max-w-md text-lg leading-8 text-primary/80 lg:ml-[42%]">
              Casey is the first conversation. The firm accepts the lead, then
              the fuller account comes in for review.
            </p>
          </Reveal>
          <Reveal eager>
            <CtaPair className="mt-10" />
          </Reveal>
        </MarketingShell>
      </section>

      <MarketingSection className="pt-8">
        <Reveal>
          <MarketingHeading
            eyebrow="The promise"
            title="Casey qualifies the enquiry, takes the fuller account after you accept, and leaves the written draft for review."
          />
        </Reveal>
        <Reveal className="mt-14">
          <ProductPreview />
        </Reveal>
      </MarketingSection>

      <MarketingSection className="lg:py-28">
        <div className="grid items-start gap-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Reveal>
            <MarketingHeading
              eyebrow={`About ${env.NEXT_PUBLIC_APP_NAME}`}
              title="Fill the gaps."
              description="A short qualification chat, then a fuller account once the firm accepts. Solicitors prepare the written draft during review."
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {[
                {
                  title: "Qualify",
                  body: "Casey asks for the contact and what happened. Incomplete chats stay off the firm feed.",
                },
                {
                  title: "Account",
                  body: "After accept, photos, records and other people come in with the fuller account.",
                },
                {
                  title: "Draft",
                  body: "The firm prepares the written account during review. The chat does not draft it.",
                },
                {
                  title: "Gaps",
                  body: "Missing dates, names and documents show up before review, not after a solicitor has started reconstructing them.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <p className="font-display text-lg italic text-brand">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="lg:mt-16">
            <AboutInterviewVisual />
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="How Casey works"
            title="Solicitors keep the judgement."
          />
        </Reveal>
        <ol className="mt-12 border-t border-primary/15">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-3 border-b border-primary/15 py-8 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-8"
            >
              <p className="font-display text-3xl text-brand">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div className="max-w-2xl">
                <h3 className="text-xl text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <Reveal className="mt-10">
          <CtaPair />
        </Reveal>
      </MarketingSection>

      <MarketingSection className="lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <MarketingHeading
              eyebrow="The first draft"
              title="Turn the evidence into a first draft."
              description="The account, the evidence and the other people are already on the lead. Solicitors prepare the written draft during review."
            />
          </Reveal>
          <Reveal>
            <SourcesMergeAnimation />
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="Go Deeper"
            title="See how the first conversation works."
          />
        </Reveal>
        <div className="mt-10 border-t border-primary/15">
          {deeperLinks.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group grid gap-3 border-b border-primary/15 py-8 md:grid-cols-[9rem_minmax(0,1fr)_auto] md:items-baseline md:gap-8"
            >
              <p className="font-display text-lg italic text-brand">
                {item.label}
              </p>
              <div>
                <h3 className="text-2xl leading-snug text-primary">
                  {item.title}
                </h3>
                {"body" in item ? (
                  <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
                    {item.body}
                  </p>
                ) : null}
              </div>
              <p className="text-sm text-primary underline decoration-primary/30 underline-offset-4 group-hover:decoration-brand">
                Learn more
              </p>
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection id="billing" className="scroll-mt-24 lg:py-28">
        <Reveal>
          <MarketingHeading
            eyebrow="Pricing"
            title="Try for free."
            description="Accept three leads for free. See how the first conversation fits your intake."
          />
        </Reveal>
        <Reveal className="mt-12">
          <div className="overflow-x-auto rounded-2xl border border-primary/15">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead>
                <tr>
                  <th className="border-b border-primary/15 p-5" />
                  {pricingPlans.map((plan) => (
                    <th
                      key={plan.name}
                      className={`border-b border-primary/15 p-5 text-center align-bottom ${plan.name === "Growth" ? "bg-primary/[0.04]" : ""}`}
                    >
                      <p className="font-display text-xl text-white">
                        {plan.name}
                      </p>
                      <p className="mt-2 font-display text-3xl text-white">
                        {plan.amount}
                        {plan.unit ? (
                          <span className="ml-1 text-base font-sans text-white/50">
                            {plan.unit}
                          </span>
                        ) : null}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricingGroups.map((group) => (
                  <Fragment key={group.label}>
                    <tr className="border-t border-primary/15">
                      <th
                        colSpan={4}
                        className="bg-primary/[0.03] px-5 py-3 text-left font-display text-lg italic text-white"
                      >
                        {group.label}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.label} className="border-t border-primary/10">
                        <th className="p-5 text-sm font-medium text-white">
                          {row.label}
                        </th>
                        {row.cells.map((cell, index) => (
                          <td
                            key={`${row.label}-${pricingPlans[index].name}`}
                            className={`p-5 text-sm leading-6 text-white ${pricingPlans[index].name === "Growth" ? "bg-primary/[0.04]" : ""}`}
                          >
                            {cell === "Included" ? (
                              <Check
                                className="h-4 w-4 text-white"
                                aria-label="Included"
                              />
                            ) : (
                              cell
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </MarketingSection>

      <section
        id="early-access"
        className="scroll-mt-24 bg-[#f3efe6] py-24 text-[#12110f] lg:py-32"
      >
        <MarketingShell>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] lg:gap-20">
            <Reveal>
              <p className="font-display text-lg italic text-brand">
                Start early access
              </p>
              <h2 className="mt-3 max-w-xl font-display text-4xl leading-[1.1] sm:text-5xl">
                Give solicitors more time for their best thinking.
              </h2>
              <CtaPair className="mt-10" tone="light" />
            </Reveal>
            <Reveal>
              <div className="text-[#12110f] [&_input]:border-[#12110f]/20 [&_input]:bg-white [&_label]:text-[#12110f]">
                <p className="mb-5 text-sm text-[#12110f]/60">
                  Leave your details and we will be in touch.
                </p>
                <WaitlistSignupForm
                  id="waitlist"
                  disableCalendly
                  submitVariant="brand"
                  submitClassName="h-11 w-auto rounded-full px-7 text-base"
                />
              </div>
            </Reveal>
          </div>
        </MarketingShell>
      </section>
    </div>
  );
}
