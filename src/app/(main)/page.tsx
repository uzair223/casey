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
    title: "Enquiries arrive",
    body: "Enquirers tell Casey what happened on the firm's page or, on Growth, in a chat on the firm's own website. Casey confirms each contact before leads reach anyone.",
  },
  {
    title: "The firm decides",
    body: "Leads appear in the list with the lead type and the enquirer's details. Solicitors accept them, or decline them, with the reason recorded.",
  },
  {
    title: "Claimants give their accounts",
    body: "A private link arrives by email. Casey takes claimants through their accounts in stages, with photos and records added along the way, and claimants check everything before sending.",
  },
  {
    title: "Witnesses are asked",
    body: "Casey picks out the colleagues and witnesses named in each account. The firm chooses who to ask, and each gets their own link.",
  },
  {
    title: "Solicitors write the statements",
    body: "Accounts, documents, chronology, and gaps are on the file. Solicitors draft the statement, ask follow-up questions, and send it for signature.",
  },
] as const;

const deeperLinks = [
  {
    label: "Platform",
    title: "What claimants see, and what the team sees.",
    body: "The enquiry page, the leads list, the accounts, and the statement.",
    href: "/platform",
  },
  {
    label: "Security",
    title: "Private links for claimants. A record for the firm.",
    body: "Who opened each account, what was sent, and the signature record.",
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
              Enquirers fill in the firm&apos;s page at 9pm. By morning Casey has
              their names, confirmed ways to reach them, and what happened.
              The firm decides which become files, and pays for the leads it
              accepts.
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
            title="What lands on the desk after the firm says yes."
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
              title="The first conversation is done before anyone at the firm picks up the phone."
              description="Casey holds that conversation. Solicitors spend their time on the files the firm keeps."
            />
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {[
                {
                  title: "Out of hours",
                  body: "Every enquiry gets a reply, including the ones at 9pm on a Friday.",
                },
                {
                  title: "The right questions",
                  body: "Personal injury, accident at work, and clinical negligence come ready to use, each with its own questions. Firms add their own lead types when the work calls for it.",
                },
                {
                  title: "Confirmed contacts",
                  body: "Casey sends a short code to the email or phone enquirers give. Leads in the list are people the firm can reach.",
                },
                {
                  title: "Your name on the door",
                  body: "The page carries the firm's name. On Growth, its colours, logo, and welcome message too.",
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
            title="From enquiry to file."
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
              eyebrow="Review"
              title="The facts are on the file before review starts."
              description="Chronology, agreed facts, conflicts, gaps, and documents are listed when solicitors sit down. The statement is theirs to write."
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
            title="The product, the safeguards, and how to start."
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
            title="Pay for the leads you accept."
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
                Every enquiry answered. Every file worth opening.
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
