import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  ListChecks,
  MessageSquareText,
} from "lucide-react";

import {
  AboutInterviewVisual,
  SourcesMergeAnimation,
} from "@/components/marketing/about-visual";
import { CtaPair } from "@/components/marketing/cta-pair";
import { MarketingHeading } from "@/components/marketing/heading";
import { HeroGlow } from "@/components/marketing/hero-glow";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection, MarketingShell } from "@/components/marketing/shell";
import { WaitlistSignupForm } from "@/components/waitlist/waitlist-form";
import { env } from "@/lib/env";

const practiceTypes = [
  "Personal injury",
  "Road traffic",
  "Employers' liability",
  "Public liability",
  "Clinical negligence",
];

const steps = [
  {
    title: "Fill the gaps before you have to chase",
    body: "Casey interviews the witness, asks the follow-up questions, and collects supporting evidence while the account is still coming in.",
    icon: MessageSquareText,
  },
  {
    title: "Turn the evidence into a first draft",
    body: "Interviews, transcripts and exhibits are condensed into a statement. Your solicitors tweak it instead of writing from scratch.",
    icon: FileText,
  },
  {
    title: "Find what's missing before review",
    body: "Missing dates, unsupported detail and conflicting accounts show up on the gap list before a solicitor sits down.",
    icon: ListChecks,
  },
  {
    title: "Give solicitors more time for their best thinking",
    body: "Review starts with a first draft, the evidence trail, and the gaps in view. Judgement stays with you.",
    icon: Check,
  },
] as const;

const deeperLinks = [
  {
    label: "Platform",
    title: "Casey removes the chasing from witness statements",
    body: "See how interviews, evidence, first drafts and gaps stay in one place, from the intake link to review.",
    href: "/platform",
  },
  {
    label: "Security",
    title: "Built for sensitive files",
    body: "Firm-scoped access, tokenised witness links, and an audit trail you can explain to a practice manager.",
    href: "/legal/security",
  },
  {
    label: "Early access",
    title: "Bring a live chasing pain",
    body: "Show us a matter that still needs chasing. We will show where Casey takes that work off your solicitors.",
    href: "/#early-access",
  },
] as const;

const securityCards = [
  {
    label: "Privacy",
    title: "Consent before anything is captured",
    body: "Witnesses acknowledge the privacy notice before intake continues. Public links stay scoped to one task.",
  },
  {
    label: "Access",
    title: "Firm-scoped by default",
    body: "Roles, row-level security, and time-bound witness links keep matters inside the right firm.",
  },
  {
    label: "Audit",
    title: "A trail you can explain",
    body: "Intake, drafting, follow-up, and review leave an operational record, not a pile of inbox forwards.",
  },
  {
    label: "Control",
    title: "Your data, your rules",
    body: "DSAR export, lifecycle controls, and firm boundaries are built in so adoption does not mean losing the file.",
  },
] as const;

const testimonials = [
  {
    quote:
      "The valuable part is not just the draft. It is seeing what is still missing before a solicitor spends time reviewing it.",
    attribution: "Early product review",
    firm: "Claimant PI team",
  },
  {
    quote:
      "Get the account, fill the gaps, then review a statement. That is how the work should feel.",
    attribution: "Practice operations",
    firm: "Product discovery",
  },
  {
    quote:
      "If the first draft arrived with chronology and exhibits attached, review would start in a completely different place.",
    attribution: "Fee earner session",
    firm: "Personal injury",
  },
] as const;

export default function Home() {
  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
      <section className="relative isolate -mt-[calc(var(--header-height)+var(--header-gap))] flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-20 text-center">
        <HeroGlow />
        <Reveal eager>
          <Link
            href="/#early-access"
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-1.5 text-base text-primary"
          >
            <span aria-hidden className="text-brand">
              ✦
            </span>
            Early access for claimant teams
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>
        <Reveal eager delay={80}>
          <h1 className="mt-8 font-display text-5xl font-normal leading-tighter tracking-tight text-primary sm:text-7xl lg:text-[96px] lg:leading-[1.1]">
            Witness statements<br className="hidden md:block"/> without the chasing.
          </h1>
        </Reveal>
        <Reveal eager delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-tight text-primary/80 sm:text-xl">
            Casey interviews witnesses, gathers evidence and finds what&apos;s
            missing, so your solicitors start with a review-ready first draft.
          </p>
        </Reveal>
        <Reveal eager delay={240}>
          <CtaPair className="mt-10 justify-center" />
        </Reveal>
      </section>

      <div className="overflow-hidden py-6">
        <div className="flex h-16 w-max animate-marquee items-center">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex items-center gap-16 px-8 text-lg tracking-wide text-primary/35"
              aria-hidden={copy === 1}
            >
              {practiceTypes.map((item) => (
                <span key={`${copy}-${item}`} className="whitespace-nowrap">
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="The promise"
            title="Casey removes the chasing from witness statements."
            description="Casey asks the follow-up questions, collects supporting evidence, spots missing information before review, and turns everything into a review-ready first draft."
          />
        </Reveal>
        <Reveal delay={120} className="mt-14">
          <ProductPreview />
        </Reveal>
      </MarketingSection>

      <MarketingSection className="relative overflow-hidden">
        <div aria-hidden className="hero-ring-glow opacity-40" />
        <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Reveal>
            <MarketingHeading
              align="left"
              eyebrow={`About ${env.NEXT_PUBLIC_APP_NAME}`}
              title="Fill the gaps before you have to chase."
              description="Casey interviews witnesses, gathers evidence and finds what is missing, so your solicitors start with a review-ready first draft instead of a pile of transcripts."
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                {
                  title: "Interview",
                  body: "Casey asks the follow-up questions until the account holds. You do not have to chase the next answer.",
                },
                {
                  title: "Evidence",
                  body: "Photos, records and exhibits come in with the account, attached to the facts they support.",
                },
                {
                  title: "Draft",
                  body: "That material is condensed into a first-person statement your solicitors can tweak.",
                },
                {
                  title: "Gaps",
                  body: "Missing dates, names and documents show up before review, not after a solicitor has started reconstructing them.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <p className="text-sm text-brand">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120} className="relative">
            <AboutInterviewVisual />
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="How Casey works"
            title="Casey removes the chasing. Solicitors keep the judgement."
          />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 80}>
              <div className="h-full rounded-2xl border border-primary/10 bg-transparent p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/40 text-brand">
                  <step.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-6 text-xl text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200} className="mt-10">
          <CtaPair />
        </Reveal>
      </MarketingSection>

      <MarketingSection className="relative overflow-hidden">
        <div aria-hidden className="hero-ring opacity-50" />
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <MarketingHeading
              align="left"
              eyebrow="The first draft"
              title="Turn the evidence into a first draft."
              description="Interviews, transcripts, photos and records are condensed into a statement. Your solicitors mark it up instead of writing from scratch."
            />
          </Reveal>
          <Reveal delay={120} className="w-full">
            <SourcesMergeAnimation />
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="Go Deeper"
            title="See how the chasing drops out."
          />
        </Reveal>
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {deeperLinks.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <Link
                href={item.href}
                className="group flex h-full flex-col rounded-2xl border border-primary/10 bg-primary/[0.03] p-8"
              >
                <p className="text-sm text-brand">{item.label}</p>
                <h3 className="mt-4 text-2xl leading-snug text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">
                  {item.body}
                </p>
                <p className="mt-6 inline-flex items-center gap-1 text-sm text-primary">
                  Learn more
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="Security & Privacy"
            title="Witness data deserves the highest protection."
          />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {securityCards.map((item, index) => (
            <Reveal key={item.title} delay={index * 70}>
              <div className="h-full rounded-2xl border border-primary/10 bg-primary/[0.03] p-8">
                <p className="text-sm text-brand">{item.label}</p>
                <h3 className="mt-4 text-2xl leading-snug text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10">
          <Link
            href="/legal/security"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-brand"
          >
            Review the security policy
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>
      </MarketingSection>

      <section className="overflow-hidden py-32">
        <MarketingShell>
          <Reveal>
            <MarketingHeading
              eyebrow="Wall of love"
              title="Shaped with claimant firms who were tired of chasing."
            />
          </Reveal>
        </MarketingShell>
        <div className="mt-14 flex w-max animate-marquee gap-4">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex gap-4 px-2"
              aria-hidden={copy === 1}
            >
              {testimonials.map((item) => (
                <blockquote
                  key={`${copy}-${item.attribution}`}
                  className="w-[min(90vw,420px)] shrink-0 rounded-2xl border border-primary/10 bg-primary/[0.03] p-8"
                >
                  <p className="font-display text-2xl leading-9 text-primary">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <footer className="mt-8 text-sm text-muted-foreground">
                    <p className="text-primary">{item.attribution}</p>
                    <p className="mt-1">{item.firm}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          ))}
        </div>
      </section>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="Pricing"
            title="Try for free."
            description="Open three cases for completely free. See how it fits into your workflow."
          />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-primary/10 bg-primary/[0.03] p-8">
              <p className="text-sm text-brand">Practice</p>
              <h3 className="mt-4 text-2xl leading-snug text-primary">
                £149 a month. Five people. Thirty cases.
              </h3>
            </div>
          </Reveal>
          <Reveal delay={70}>
            <div className="h-full rounded-2xl border border-primary/10 bg-primary/[0.03] p-8">
              <p className="text-sm text-brand">Firm</p>
              <h3 className="mt-4 text-2xl leading-snug text-primary">
                £49 a seat. From six people. Eight cases a seat.
              </h3>
            </div>
          </Reveal>
        </div>
        <Reveal className="mt-8">
          <p className="text-center text-sm text-muted-foreground">
            £12 for another case.
          </p>
        </Reveal>
      </MarketingSection>

      <section
        id="early-access"
        className="scroll-mt-24 bg-[#f4f5fb] py-32 text-[#101010]"
      >
        <MarketingShell className="text-center">
          <Reveal>
            <p className="text-[14px] uppercase tracking-[0.15em] text-brand">
              Start early access
            </p>
            <h2 className="mx-auto mt-3 max-w-4xl font-display text-4xl leading-[1.1] sm:text-5xl lg:text-[48px]">
              Give solicitors more time for their best thinking.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#101010]/70">
              Three files included.
            </p>
            <CtaPair className="mt-10 justify-center" tone="light" />
            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                { value: "Less", label: "chasing" },
                { value: "More", label: "judgement" },
                { value: "Now", label: "in early access" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="font-display text-4xl">{item.value}</p>
                  <p className="mt-1 text-sm text-[#101010]/60">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-14 max-w-md text-left text-[#101010] [&_input]:border-[#101010]/20 [&_input]:bg-white [&_label]:text-[#101010]">
              <p className="mb-5 text-center text-sm text-[#101010]/60">
                Leave your details and we will be in touch.
              </p>
              <WaitlistSignupForm id="waitlist" disableCalendly />
            </div>
          </Reveal>
        </MarketingShell>
      </section>
    </div>
  );
}
