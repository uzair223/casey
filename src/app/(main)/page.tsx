import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Link2,
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
    title: "Intake",
    body: "Send a secure, time-limited link from the matter. The witness sees the privacy notice and can start in minutes.",
    icon: Link2,
  },
  {
    title: "Capture",
    body: "Casey asks the next useful question, requests evidence in context, and keeps the account moving until it is usable.",
    icon: MessageSquareText,
  },
  {
    title: "Draft",
    body: "Turn the transcript into structured statement sections, with chronology, exhibits, and source context still attached.",
    icon: FileText,
  },
  {
    title: "Close",
    body: "Follow up on gaps, send final review, and keep outstanding witness work visible without a spreadsheet.",
    icon: Check,
  },
] as const;

const features = [
  {
    label: "Speed",
    title: "From first account to a draft worth reviewing",
    body: "Casey handles the interview, the write-up, and the gap list so solicitors start with something they can mark up.",
  },
  {
    label: "Preparation",
    title: "Walk into review already knowing the holes",
    body: "Chronology, agreed facts, disputes, and missing evidence are surfaced before a fee-earner spends time reconstructing them.",
  },
  {
    label: "Quality",
    title: "Catch thin accounts before they become write-offs",
    body: "Missing dates, unsupported detail, and absent witnesses show up at intake, not at 4pm before a deadline.",
  },
  {
    label: "Templates",
    title: "Your firm's style, every time",
    body: "Publish statement templates once. Every matter starts from the same standard, instead of another blank page.",
  },
  {
    label: "Scale",
    title: "Grow the team, not the chasing",
    body: "Shared templates, role-based access, and one place for outstanding witness work keep quality consistent as the caseload grows.",
  },
] as const;

const deeperLinks = [
  {
    label: "Platform",
    title: "Witness intake to final review",
    body: "See how Casey connects interviews, drafts, evidence, and case intelligence in one workflow.",
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
    title: "Map it to your workflow",
    body: "Bring a real template and a live intake pain. We will show where the chasing drops out.",
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
    attribution: "Early workflow review",
    firm: "Claimant PI team",
  },
  {
    quote:
      "This matches the way our team already thinks about statements: get the account, chase the gaps, then prepare something worth reviewing.",
    attribution: "Practice operations",
    firm: "Product discovery",
  },
  {
    quote:
      "If the first draft arrived with chronology and exhibits already attached, review would start in a completely different place.",
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
            {env.NEXT_PUBLIC_APP_NAME} turns witness interviews into
            review-ready statements. Purpose-built for UK claimant firms.
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
            eyebrow="The Platform"
            title="Everything you need, in one place."
            description="Send a link, capture the account, and Casey drafts the statement. Chronology, gaps, and evidence stay attached."
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
              title={`${env.NEXT_PUBLIC_APP_NAME} turns witness interviews into statements your solicitors can actually review.`}
              description="Our goal is simple: give claimant teams back the hours lost to chasing, reconstructing, and rewriting. Casey handles the intake, the first draft, and the gap list, so every interview ends with something worth reading."
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                {
                  title: "Interview",
                  body: "A guided account, not a blank form. Casey asks the next useful question until the story holds.",
                },
                {
                  title: "Evidence",
                  body: "Photos, records, and exhibits attach to the fact they support, instead of sitting in a side email.",
                },
                {
                  title: "Draft",
                  body: "Structured statement sections, with chronology and source context still sitting next to the wording.",
                },
                {
                  title: "Gaps",
                  body: "Missing dates, names, and documents surface before a solicitor spends time reconstructing them.",
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
            title="From intake link to a review-ready statement"
          />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              eyebrow="More than an interview"
              title="Bring every source into one statement."
              description="Recordings and answers are not the whole file. Drop in photos, records, and exhibits and Casey folds them into the same draft, chronology, and gap list."
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
            align="left"
            eyebrow="Built for claimant firms"
            title="The draft is the easy part. The rest is the work."
            className="max-w-3xl"
          />
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {features.map((item, index) => (
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
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <MarketingHeading
            eyebrow="Go Deeper"
            title="Explore how Casey works for your firm."
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
              title="Shaped with real claimant-firm workflows."
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
              Your solicitors deserve their best thinking, not more chasing.
            </h2>
            <CtaPair className="mt-10 justify-center" tone="light" />
            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                { value: "One", label: "workflow" },
                { value: "UK", label: "claimant firms" },
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
