"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSearch,
  FileText,
  Fingerprint,
  Link2,
  LockKeyhole,
  MailCheck,
  MessageSquareText,
  Quote,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { WaitlistSignupForm } from "@/components/waitlist/waitlist-form";
import { MessageCard } from "@/components/ui/message";
import { env } from "@/lib/env";
import { PageTitle } from "@/components/page-title";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const demoMessages = [
  {
    role: "assistant",
    content:
      "Before we draft, I need the sequence in your own words. Where were you immediately before the incident?",
  },
  {
    role: "user",
    content:
      "I arrived at the site around 08:10. The barrier dropped as I passed and struck my left shoulder.",
  },
  {
    role: "assistant",
    content:
      "Thank you. Do you have photos, treatment records, or anyone who saw the barrier fall?",
  },
] as const;

const proofPoints = [
  "Built for PI, RTA, EL/PL, and clinical negligence teams",
  "Review-ready first drafts with case intelligence",
  "Fewer loose emails and manual witness chasers",
  "Firm-scoped governance from intake to final review",
] as const;

const painPoints = [
  {
    title: "Chasing drains fee-earner time",
    body: "Witness evidence often arrives across emails, calls, attachments, and reminders. Every missing date or unclear sequence creates another admin loop before legal review can start.",
  },
  {
    title: "Gaps surface too late",
    body: "When the first account is thin, teams discover the problem during drafting or review: unclear chronology, unsupported detail, missing witnesses, evidence conflicts, or documents that should have been requested days earlier.",
  },
  {
    title: "Write-offs hide in the process",
    body: "Paralegals and solicitors spend recoverable attention reconstructing facts instead of reviewing them. Casey is designed to move that work into a structured intake flow from the start.",
  },
] as const;

const workflow = [
  {
    icon: Link2,
    title: "Open the intake",
    body: "Send a secure, time-limited link from the matter. The witness sees the right privacy notice, consents before starting, and can add evidence as the account develops.",
  },
  {
    icon: BrainCircuit,
    title: "Build the account",
    body: "Casey asks focused follow-up questions, tracks chronology and missing facts, and keeps the interview moving until the narrative is useful for statement preparation.",
  },
  {
    icon: FileText,
    title: "Draft and analyse",
    body: "Turn the transcript into structured statement sections, then review chronology, facts, gaps, conflicts, and exhibit-aware evidence context beside the draft.",
  },
  {
    icon: MailCheck,
    title: "Close the loop",
    body: "Request clarification, send final review, log events, and keep outstanding witness tasks visible without spreadsheet chasing.",
  },
] as const;

const outcomes = [
  {
    icon: Clock3,
    title: "Reduce witness chasing",
    body: "Use structured intake, reminders, and follow-up requests to keep outstanding witness work visible without relying on spreadsheets or inbox memory.",
  },
  {
    icon: FileCheck2,
    title: "Get to review faster",
    body: "Move from raw witness answers to a review-ready first draft while preserving the transcript, evidence descriptors, case analysis, and review notes beside the document.",
  },
  {
    icon: ShieldCheck,
    title: "Make adoption easier",
    body: "Consent, scoped links, role-based access, audit events, and DSAR export support give practice managers a governance story they can explain.",
  },
] as const;

const proofSignals = [
  {
    value: "1 workflow",
    label: "intake, drafting, follow-up, final review, and audit history",
  },
  {
    value: "Every case",
    label:
      "can surface chronology, agreed facts, disputes, missing information, and evidence context",
  },
  {
    value: "Beta review",
    label:
      "available for claimant teams with real templates and live intake pain",
  },
] as const;

const testimonials = [
  {
    quote:
      "The valuable part is not just the draft. It is seeing what is still missing before a solicitor spends time reviewing it.",
    attribution: "Early workflow review with a claimant PI team",
  },
  {
    quote:
      "This matches the way our team already thinks about statements: get the account, chase the gaps, then prepare something worth reviewing.",
    attribution: "Practice operations feedback during product discovery",
  },
] as const;

const capabilities = [
  "Magic-link intake with state checks and privacy acknowledgement",
  "Guided interviews that request evidence in context",
  "Transcript-to-statement formalization with structured sections",
  "Case intelligence across chronology, facts, gaps, conflicts, and evidence",
  "AI-generated document descriptors and exhibit-aware evidence summaries",
  "Inline document editing for paragraph-level refinement",
  "Template publishing, forking, DOCX validation, and firm defaults",
  "Mentions, notes, notifications, audit events, and lifecycle controls",
] as const;

export default function Home() {
  const primaryCta = env.NEXT_PUBLIC_CALENDLY_LINK
    ? {
        href: env.NEXT_PUBLIC_CALENDLY_LINK,
        label: "Book a demo",
        external: true,
      }
    : { href: "/#beta", label: "Request early access", external: false };

  return (
    <>
      <section className="relative overflow-hidden rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl">
            <PageTitle
              subtitle="Witness evidence intake for UK legal teams"
              title="Turn witness interviews into stronger statements, faster."
              description={`${env.NEXT_PUBLIC_APP_NAME} gives claimant firms a secure intake, drafting, review, and case intelligence workflow for witness statements. Capture the facts once, keep evidence organised, and move from first account to review-ready draft with chronology, gaps, conflicts, and exhibit context already surfaced.`}
              titleClassName="mt-8 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl"
              descriptionClassName="mt-5 max-w-2xl text-base leading-7 sm:text-lg"
            />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="rounded-full px-7">
                <Link
                  href={primaryCta.href}
                  target={primaryCta.external ? "_blank" : undefined}
                  rel={primaryCta.external ? "noreferrer" : undefined}
                >
                  {primaryCta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="rounded-full px-7"
              >
                <Link href="/platform">Explore the platform</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {proofPoints.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <Card className="rounded-3xl border-border/70 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-muted-foreground">
                Intake in motion
              </CardTitle>
              <CardDescription>
                A guided conversation that knows what a legal team needs next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {demoMessages.map((message, index) => (
                  <MessageCard
                    key={`demo-message-${index}`}
                    message={{ role: message.role, content: message.content }}
                  />
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Card size="sm" className="rounded-2xl bg-background/70">
                  <CardContent className="p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Intelligence:
                    </span>{" "}
                    chronology, facts, gaps, exhibits, and review notes stay
                    together.
                  </CardContent>
                </Card>
                <Card size="sm" className="rounded-2xl bg-background/70">
                  <CardContent className="p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Governance:
                    </span>{" "}
                    consent, scoped access, audit events, and lifecycle
                    controls.
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Why it matters"
          title="The hidden cost is not the draft. It is everything before it."
          description="Witness statements often start with fragmented emails, missed details, and repeated chasing. By the time a solicitor sees the work, the team may already have lost hours reconstructing facts that should have been captured clearly at intake."
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {painPoints.map((item) => (
            <Card key={item.title} className="rounded-3xl bg-card/75">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {item.body}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Commercial case"
          title="Built to protect review time"
          description="Casey is designed around the economics of statement work: fewer admin loops, cleaner first drafts, and less fee-earner time spent turning scattered witness material into a chronology, fact pattern, or gap list."
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {outcomes.map((item) => (
            <Card key={item.title} className="rounded-3xl bg-card/75">
              <CardHeader>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-lg text-foreground">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {item.body}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {proofSignals.map((item) => (
            <Card key={item.value} className="rounded-3xl bg-background/70">
              <CardHeader>
                <CardTitle className="font-display text-3xl text-primary">
                  {item.value}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {item.label}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Case intelligence"
          title="See what the witness material is saying before review starts"
          description="Casey combines formalized statements and evidence descriptors to produce a practical case view: chronology, shared facts, disputed points, missing information, and the exhibits behind each issue."
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              icon: BrainCircuit,
              title: "Facts and gaps",
              body: "Summarise what the available statements support, what is disputed, and what follow-up evidence would make the file stronger.",
            },
            {
              icon: Clock3,
              title: "Chronology",
              body: "Convert witness accounts and document descriptors into a timeline with source references rather than another manual note.",
            },
            {
              icon: FileSearch,
              title: "Evidence context",
              body: "Use document descriptors and exhibit numbers so photos, repair quotes, records, and internal uploads stay attached to the legal issue they support.",
            },
          ].map((item) => (
            <Card key={item.title} className="rounded-3xl bg-card/75">
              <CardHeader>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <CardTitle className="mt-3 text-lg text-foreground">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {item.body}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Workflow"
          title={`How ${env.NEXT_PUBLIC_APP_NAME} moves a statement forward`}
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-4">
          {workflow.map((item, index) => (
            <Card key={item.title} className="rounded-3xl bg-card/75">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <CardTitle className="mt-4 text-lg text-foreground">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {item.body}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <PageTitle
              subtitle="Platform"
              title="Everything around the statement, not just the draft"
              description="Casey is built for the operational reality around witness evidence: intake, templates, collaboration, case intelligence, security controls, and follow-through."
              titleTag="h2"
            />
            <Button asChild variant="outline" className="mt-6 rounded-full">
              <Link href="/platform">
                See platform details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => (
              <Card key={item} size="sm" className="rounded-2xl bg-card/75">
                <CardHeader className="flex-row items-start gap-2.5 text-sm text-muted-foreground">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                  <span>{item}</span>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Built for firms"
          title="Designed for claimant teams handling PI, RTA, EL/PL, and clinical negligence work"
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Better inputs for better legal review
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Instead of asking fee-earners to reconstruct a statement from
                scattered messages, Casey structures the work before it reaches
                review. The witness gives the account, the system asks the next
                useful question, and the legal team receives a draft with
                context, evidence, and case intelligence still attached.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "Chronology and evidence captured together",
                "Facts, disputes, and missing information surfaced",
                "Review workflow after AI formalization",
                "Follow-up channel for missing details",
                "Templates governed by firm defaults",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-accent-foreground" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <Fingerprint className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 text-lg text-foreground">
                Security that supports adoption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-6">
                Tokenised intake, firm-scoped access, audit-event coverage,
                privacy notices, and DSAR tooling help firms introduce AI into
                witness work with a governance story they can explain.
              </CardDescription>
              <Button asChild variant="link" size={null} className="mt-3 px-0">
                <Link href="/legal/security">
                  Review security policy
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Early proof"
          title="Shaped with real claimant-firm workflows"
          description="Casey is in early access, so the most useful proof is practical: bring your current witness journey, templates, and review bottlenecks, and see how the product handles them."
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {testimonials.map((item) => (
            <Card key={item.quote} className="rounded-3xl bg-card/75">
              <CardHeader>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <Quote className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <blockquote className="font-display text-xl leading-8 text-primary">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <p className="mt-4 text-sm text-muted-foreground">
                  {item.attribution}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="beta" className="mx-auto mt-24 max-w-6xl sm:mt-28">
        <div className="overflow-hidden rounded-3xl border-border/70 bg-card/85">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-border/70 bg-background/60 p-8 lg:border-b-0 lg:border-r">
              <PageTitle
                subtitle="Demo"
                title="Put your current witness workflow under the microscope."
                description="Book a practical walkthrough with your templates, witness journey, review steps, case analysis needs, and governance questions. We will show where Casey removes chasing, protects review time, and keeps the file auditable."
                titleTag="h2"
                titleClassName="mt-3 max-w-xl text-3xl sm:text-4xl"
                descriptionClassName="mt-4 max-w-xl text-sm leading-6 sm:text-base"
              />

              <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
                {[
                  "Workflow review against your current intake process",
                  "Case intelligence mapped to your review bottlenecks",
                  "Template and DOCX readiness discussion",
                  "Clear rollout path for a pilot team",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-accent-foreground" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8">
              <WaitlistSignupForm id="waitlist" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: MessageSquareText, label: "Guided witness interviews" },
            {
              icon: FileSearch,
              label: "Case intelligence and evidence context",
            },
            { icon: LockKeyhole, label: "Governed legal operations" },
          ].map((item) => (
            <Card
              key={item.label}
              size="sm"
              className="rounded-2xl border-border/70 bg-card/60"
            >
              <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <item.icon className="h-4 w-4 text-accent-foreground" />
                <span>{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
