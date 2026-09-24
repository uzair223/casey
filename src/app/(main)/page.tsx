import Link from "next/link";

import { PricingTable } from "@/components/marketing/pricing-table";
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
import {
  EXTRA_LEAD_PRICE_GBP,
  FREE_LEAD_LIMIT,
  GROWTH_ACCEPTED_LEADS_PER_MONTH,
  GROWTH_PRICE_GBP,
  STARTER_ACCEPTED_LEADS_PER_MONTH,
  STARTER_PRICE_GBP,
} from "@/lib/billing/plans";
import { env } from "@/lib/env";

const steps = [
  {
    title: "Someone answers straight away",
    body: "The hosted page takes the enquiry while the office is closed. On Growth, the same chat can sit on your website.",
  },
  {
    title: "You choose what becomes a file",
    body: "Accept the lead, or decline it with one of your reasons. The feed shows the enquiries that are ready.",
  },
  {
    title: "The evidence follows that decision",
    body: "After you accept, the person adds photos, records, and anyone else involved.",
  },
  {
    title: "Solicitors start on the draft",
    body: "The account and the gap list are already on the lead. The written draft is prepared in review.",
  },
] as const;

const deeperLinks = [
  {
    label: "Platform",
    title: "Follow one lead from the public page to review.",
    body: "The feed, the account, the exhibits, and who on the team sees them.",
    href: "/platform",
  },
  {
    label: "Security",
    title: "A private link for each person, and a trail for the firm.",
    body: "Who opened the account, what they sent, and the signature record.",
    href: "/legal/security",
  },
  {
    label: "Early access",
    title: "Bring one live enquiry.",
    body: "We will show the file your team would receive.",
    href: "/#early-access",
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
              Leads worth opening.
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
              Casey answers the person first and puts a qualified lead on
              the feed. You pay for the ones you accept. Seats are included.
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
            title="The story, the evidence, and the gaps."
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
              title="Hours back for the work only a solicitor can do."
              description="The first conversation happens before anyone at the firm picks it up."
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {[
                {
                  title: "After hours",
                  body: "An enquiry at 9pm gets an answer, and waits on the feed until morning.",
                },
                {
                  title: "Your questions",
                  body: "Each lead type asks for the facts that matter to that claim.",
                },
                {
                  title: "Your reasons",
                  body: "When a lead does not fit, the firm records why and moves on.",
                },
                {
                  title: "Your page",
                  body: "The chat carries the firm's name, lead types, and wording.",
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
            title="Then the file is yours."
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
              title="Review opens on a real file."
              description="Dates, exhibits, and the gap list are already there. Solicitors write the draft."
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
            title="See the product, the safeguards, and how to start."
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
            title="Pay for accepted leads."
            description={`${FREE_LEAD_LIMIT} free. Starter is £${STARTER_PRICE_GBP}/month for ${STARTER_ACCEPTED_LEADS_PER_MONTH} accepted leads. Growth is £${GROWTH_PRICE_GBP}/month for ${GROWTH_ACCEPTED_LEADS_PER_MONTH} accepted leads. An extra lead is £${EXTRA_LEAD_PRICE_GBP}. Seats are included.`}
          />
        </Reveal>
        <Reveal className="mt-12">
          <PricingTable />
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
