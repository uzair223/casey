"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileCog,
  FileSearch,
  FileText,
  Fingerprint,
  Link2,
  LockKeyhole,
  MailCheck,
  MessageSquareText,
  Sparkles,
  Users,
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
import { cn } from "@/lib/utils";

const demoMessages = [
  {
    role: "assistant",
    content:
      "Thanks. To help your solicitor, please describe the incident in date order, starting with where you were immediately before it happened.",
  },
  {
    role: "user",
    content:
      "I entered the site at around 08:10. The barrier dropped as I passed and struck my left shoulder.",
  },
  {
    role: "assistant",
    content:
      "Understood. Do you have any photos, treatment records, or witness names we should attach as supporting evidence?",
  },
] as const;

export default function Home() {
  return (
    <main className="pb-20 pt-6 sm:pt-10">
      <section className="relative overflow-hidden rounded-4xl border border-border/70 bg-background/80 px-6 py-14 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_14%,rgba(45,212,191,0.12),transparent_35%),radial-gradient(circle_at_88%_80%,rgba(56,189,248,0.10),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-background/35 lg:w-[42%]" />

        <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="flex max-w-3xl flex-col">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
              Built for UK legal operations
            </p>

            <h1 className="mt-8 font-display text-4xl leading-[1.02] text-primary lg:text-5xl">
              Witness statements,
              <br className="hidden sm:block" />
              <em className="italic">without the chaos.</em>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {env.NEXT_PUBLIC_APP_NAME} combines secure witness intake,
              AI-assisted drafting, inline document editing, and governed
              collaboration in one workflow for claimant firms.
            </p>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Built for personal injury practices handling RTA, EL/PL, and
              clinical negligence work.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                asChild
                className="rounded-full px-7 shadow-lg shadow-accent/20"
              >
                {env.NEXT_PUBLIC_CALENDLY_LINK ? (
                  <Link href={env.NEXT_PUBLIC_CALENDLY_LINK} target="_blank">
                    Book a demo call
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link href="/#beta">
                    Request beta access
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="rounded-full px-7"
              >
                <Link href="/intake/demo">Preview intake flow</Link>
              </Button>
            </div>
          </div>

          <Card className="rounded-3xl bg-background!">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Live intake conversation
              </CardTitle>
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
                <Card
                  size="sm"
                  className="rounded-2xl border-border/70 bg-background/75 text-xs text-muted-foreground"
                >
                  <CardContent className="p-3">
                    <span className="font-medium text-foreground">AI:</span>{" "}
                    Tracks phase completeness and evidence intent in each turn
                  </CardContent>
                </Card>
                <Card
                  size="sm"
                  className="rounded-2xl border-border/70 bg-background/75 text-xs text-muted-foreground"
                >
                  <CardContent className="p-3">
                    <span className="font-medium text-foreground">
                      Inline editor:
                    </span>{" "}
                    Paragraph-level legal edits after AI formalization
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-8 mx-auto mt-28 max-w-6xl sm:mt-32">
        <PageTitle
          subtitle="Workflow"
          title={`How ${env.NEXT_PUBLIC_APP_NAME} works`}
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-4">
          {[
            {
              title: "Launch secure intake",
              content: (
                <>
                  <CardDescription className="text-sm leading-6">
                    Start from a case template, issue a time-limited magic link,
                    and capture privacy consent before intake begins.
                  </CardDescription>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    One-time link with controlled lifetime
                  </div>
                </>
              ),
            },
            {
              title: "Capture complete narrative",
              content: (
                <>
                  <CardDescription className="text-sm leading-6">
                    AI-guided chat asks follow-up questions, tracks phase
                    completeness, and requests evidence at the right point so
                    timelines and facts are complete before drafting.
                  </CardDescription>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Metadata-aware progression logic
                  </div>
                </>
              ),
            },
            {
              title: "Formalize, review, and edit",
              content: (
                <>
                  <CardDescription className="text-sm leading-6">
                    {env.NEXT_PUBLIC_APP_NAME} formalizes responses into
                    structured sections, supports inline document editing, and
                    keeps submission controlled, auditable, and review-ready.
                  </CardDescription>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Statement preview and inline editing
                  </div>
                </>
              ),
            },
          ].map((item, index) => (
            <Card
              key={index}
              className={cn(
                "overflow-hidden md:flex items-center md:min-h-64 rounded-3xl border-border/70 bg-card/75 col-span-3",
                index % 2 && "col-start-2",
              )}
            >
              <CardHeader className="md:h-full border-b border-border/70 bg-background/60 lg:border-b-0 lg:border-r">
                <CardDescription className="font-mono text-3xl font-semibold tracking-tight text-primary/80">
                  0{index + 1}
                </CardDescription>
                <CardTitle className="md:w-max font-display text-lg md:text-2xl text-primary">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {item.content}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-8 mx-auto mt-28 max-w-6xl sm:mt-32">
        <PageTitle
          subtitle="Feature highlights"
          title="From first interview to final draft, faster."
          titleTag="h2"
        />

        <div className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
            <Card className="rounded-3xl border-border/70 bg-card/75">
              <CardHeader className="flex-row items-center gap-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-foreground mb-2">
                  Complete witness statements in one pass
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  {env.NEXT_PUBLIC_APP_NAME} flags vague answers and prompts
                  focused follow-ups automatically, helping teams complete
                  statements in fewer interview cycles.
                </CardDescription>
                <CardDescription className="text-sm leading-6">
                  Narratives stay coherent from first account to final draft,
                  reducing avoidable fee-earner rework.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 bg-card/75">
              <CardHeader className="flex-row items-center gap-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <FileText className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-foreground mb-2">
                  Inline document editor for legal teams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  Refine generated sections inline with AI-assisted edits to
                  tighten wording, chronology, and evidential clarity before
                  solicitor review.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.45fr]">
            <Card className="rounded-3xl border-border/70 bg-card/75">
              <CardHeader className="flex-row items-center gap-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-foreground mb-2">
                  Internal collaboration with mentions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  Case and statement notes support mentions, pinning, edit
                  history, and in-app notifications for faster matter
                  coordination.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70 bg-card/75">
              <CardHeader className="flex-row items-center gap-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg text-foreground mb-2">
                  Governed by design: audit trails and DSAR export
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-6">
                  Audit trails span core case and statement activity, with DSAR
                  export support for data access requests.
                </CardDescription>
                <CardDescription className="text-sm leading-6">
                  Role-based permissions and scoped document access keep case
                  material governed end to end.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-8 mx-auto mt-28 max-w-6xl sm:mt-32">
        <PageTitle
          subtitle="Intake process"
          title="Consistent witness capture, ready for submission."
          titleTag="h2"
        />
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Structured witness capture that adapts as the interview evolves
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Intake starts with privacy notice acknowledgement and then moves
                through guided phases. {env.NEXT_PUBLIC_APP_NAME} requests
                supporting evidence in context, tracks readiness for statement
                preparation, and locks the flow at submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "Pre-start privacy notice acknowledgement",
                "Role-safe token access with intake-state checks",
                "Context-aware evidence requests from conversation flow",
                "Formalization that merges transcript and exhibits",
                "Inline editor for paragraph-level legal refinement",
                "Follow-up request channel when legal team needs clarification",
              ].map((item) => (
                <Card key={item} size="sm" className="bg-background/70!">
                  <CardHeader className="flex-row items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <span>{item}</span>
                  </CardHeader>
                </Card>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader className="flex-row items-center gap-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <MailCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg text-foreground mb-2">
                Operational follow-through
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-6">
                Reminder rules (cadence, limits, event logs) and targeted
                follow-up emails keep outstanding witness tasks moving to
                completion without manual chasing.
              </CardDescription>
              <Card size="sm" className="mt-3 bg-background/70!">
                <CardHeader className="text-xs text-muted-foreground">
                  Recent event: follow_up_request • sent • witness notified
                </CardHeader>
              </Card>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-8 mx-auto mt-28 max-w-6xl sm:mt-32">
        <PageTitle
          subtitle="Templating system"
          title="AI-assisted template generation with controlled publishing."
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_1.45fr]">
          <Card className="rounded-3xl border-border/70 bg-card/75">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <CardTitle className="mt-2 text-lg text-foreground">
                Generate with AI, then edit in simple/JSON/DOCX views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-6">
                Template teams can prompt AI to generate a starting config,
                iterate in structured editors, and validate outputs before
                publishing.
              </CardDescription>
              <Card size="sm" className="mt-3 bg-background/70!">
                <CardHeader className="text-xs text-muted-foreground">
                  AI generation supports partial updates while preserving draft
                  state.
                </CardHeader>
              </Card>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/75 sm:[--card-padding:calc(var(--spacing)*7)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Designed for firm governance and repeatable quality
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                {env.NEXT_PUBLIC_APP_NAME} supports shared and firm-specific
                templates, forking, duplicate/archive/publish status workflows,
                DOCX template staging, and snapshot-backed consistency between
                configured fields and generated documents.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: FileCog,
                  label: "Template status workflow: draft, published, archived",
                },
                {
                  icon: LockKeyhole,
                  label: "Role-gated editing and publish controls",
                },
                {
                  icon: FileSearch,
                  label: "DOCX validation for unknown and unused placeholders",
                },
                {
                  icon: BellRing,
                  label: "Case-template linking with firm defaults/favourites",
                },
              ].map((item) => (
                <Card key={item.label} size="sm" className="bg-background/70!">
                  <CardHeader className="flex-row items-start gap-2.5 text-sm text-muted-foreground">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <span>{item.label}</span>
                  </CardHeader>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-8 mx-auto mt-28 max-w-6xl sm:mt-32">
        <PageTitle
          subtitle="Workflow surfaces"
          title="Platform capabilities across the case lifecycle"
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              icon: BadgeCheck,
              title: "Administration and oversight",
              body: "Manage organizations, waitlist operations, and demo workflows from centralized controls.",
            },
            {
              icon: Users,
              title: "Case and statement operations",
              body: "Run casework with governed access to templates, notes, mentions, and document actions.",
            },
            {
              icon: Link2,
              title: "Secure intake experience",
              body: "Capture intake through tokenized links with privacy consent, guided interview phases, and controlled submission.",
            },
            {
              icon: FileText,
              title: "Drafting and refinement",
              body: "Move from interview transcript to formalized draft and inline refinements without context switching.",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="rounded-3xl border-border/70 bg-card/75"
            >
              <CardHeader className="flex-row items-start gap-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">
                    {item.body}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-8 mx-auto mt-28 max-w-6xl sm:mt-32">
        <PageTitle
          subtitle="Automation and operations"
          title="Operational follow-through beyond the interview"
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card className="rounded-3xl border-border/70 bg-card/75">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Keep statements moving without manual chasing
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Operational tooling supports reminder rules, follow-up
                workflows, and event tracking so teams can manage outstanding
                intake tasks at scale.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "Internal reminders runner endpoint for controlled dispatch",
                "Reminder cadence and limits per statement",
                "Follow-up request events with notification history",
                "Outstanding work visibility across dashboard surfaces",
              ].map((item) => (
                <Card key={item} size="sm" className="bg-background/70!">
                  <CardHeader className="flex-row items-start gap-2.5 text-sm text-muted-foreground">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <span>{item}</span>
                  </CardHeader>
                </Card>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 bg-card/75">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Compliance and lifecycle controls
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                {
                  icon: Fingerprint,
                  label:
                    "Audit-event coverage across case and statement actions",
                },
                {
                  icon: MailCheck,
                  label: "DSAR export and account-deletion request support",
                },
                {
                  icon: BellRing,
                  label: "Retention and lifecycle automation hooks",
                },
                {
                  icon: LockKeyhole,
                  label: "Tenant-scoped data boundaries with role-based access",
                },
              ].map((item) => (
                <Card key={item.label} size="sm" className="bg-background/70!">
                  <CardHeader className="flex-row items-start gap-2.5 text-sm text-muted-foreground">
                    <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                    <span>{item.label}</span>
                  </CardHeader>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="beta" className="mx-auto mt-28 max-w-6xl sm:mt-32">
        <Card className="overflow-hidden border-border/70 bg-card/85">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-border/70 bg-background/60 p-8 lg:border-b-0 lg:border-r">
              <p className="text-sm uppercase tracking-[0.22em] text-accent-foreground">
                Early access
              </p>
              <h2 className="mt-3 max-w-xl font-display text-3xl text-primary sm:text-4xl">
                See how it fits your intake workflow before rollout.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                Get a personalised walkthrough and early pricing lock before
                general availability for your firm.
              </p>

              <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
                {[
                  "A personalised walkthrough of your intake workflow",
                  "Early pricing lock before general availability",
                  "Priority onboarding guidance for your team",
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
        </Card>
      </section>

      <section className="mx-auto mt-16 max-w-6xl">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            "Secure magic-link intake with notice consent",
            "AI-guided interviews, formalization, and inline document editing",
            "Template governance, collaboration, and audit-ready controls",
          ].map((item) => (
            <Card
              key={item}
              size="sm"
              className="rounded-2xl border-border/70 bg-card/60"
            >
              <CardContent className="p-4 text-sm text-muted-foreground">
                {item}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
