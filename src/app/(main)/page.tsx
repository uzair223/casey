"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Fingerprint,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { WaitlistSignupForm } from "@/components/waitlist/waitlist-form";
import { MessageBox } from "@/components/intake/chat-area";

export default function Home() {
  return (
    <main className="space-y-10">
      <section>
        <div className="relative overflow-hidden rounded-4xl border border-border/60 bg-background/80 shadow-2xl backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.10),transparent_28%)]" />
          <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-accent-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
                AI-guided witness intake for UK legal teams
              </div>

              <div className="space-y-5">
                <h1 className="max-w-3xl font-display text-4xl leading-[1.02] text-primary sm:text-5xl lg:text-5xl">
                  Turn scattered witness interviews into polished statements in
                  a single secure workflow.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Casey helps firms capture more complete facts, reduce
                  follow-up emails, and produce cleaner witness statements
                  faster. Send a secure link, collect the story
                  conversationally, and review a structured draft with the legal
                  team before submission.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  asChild
                  className="shadow-lg shadow-accent/20"
                >
                  <Link href="/dashboard">
                    Open the dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/intake/demo">
                    Watch witness intake in action
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="#waitlist">Join the waiting list</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Faster drafts",
                    value: "Less admin, more review",
                  },
                  {
                    label: "Cleaner evidence",
                    value: "Capture docs while the story is fresh",
                  },
                  {
                    label: "Safer intake",
                    value: "Time-limited magic links and audit trails",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-card/70 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-8 hidden h-24 w-24 rounded-full bg-accent/20 blur-3xl lg:block" />
              <Card className="relative overflow-hidden border-border/70 bg-card/80 shadow-2xl">
                <CardHeader className="space-y-2 border-b border-border/60 bg-background/60">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      Live intake preview
                    </CardTitle>
                    <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
                      <ShieldCheck className="h-4 w-4" />
                      Secure link active
                    </div>
                  </div>
                  <CardDescription>
                    A witness answers in conversation while the system tracks
                    progress, evidence, and statement completeness.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 p-5">
                  <div className="grid gap-3 rounded-3xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>Conversation</span>
                      <span>64% complete</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        {
                          role: "assistant",
                          content: "Tell me what happened in your own words",
                        },
                        {
                          role: "user",
                          content:
                            "I was walking past the site entrance when the barrier came down and struck my shoulder.",
                        },
                        {
                          role: "assistant",
                          content:
                            "Thank you. When did you first seek treatment, and do you have any photos or reports?",
                        },
                      ].map((msg, index) => (
                        <MessageBox key={index} message={msg} />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border bg-background/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <MessageSquareQuote className="h-4 w-4 text-accent-foreground" />
                        Evidence capture
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Suggested documents appear as the interview progresses,
                        so the witness can attach them at the right time.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border bg-background/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Workflow className="h-4 w-4 text-accent-foreground" />
                        Draft readiness
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        The legal team can review the structured statement
                        before it is finalized and submitted.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Secure", icon: ShieldCheck },
                  { label: "Guided", icon: BrainCircuit },
                  { label: "Auditable", icon: Fingerprint },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background/75 px-4 py-3 shadow-sm"
                  >
                    <item.icon className="h-5 w-5 text-accent-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            icon: FileText,
            title: "Statement-ready structure",
            body: "Capture the factual narrative, witness metadata, sections, and evidence in one flow.",
          },
          {
            icon: TimerReset,
            title: "Less chasing, less rework",
            body: "The platform nudges for missing details early, before the team has to rewrite the draft.",
          },
          {
            icon: ShieldCheck,
            title: "Security built into the workflow",
            body: "Use expiring magic links, audit trails, and secure document handling from day one.",
          },
          {
            icon: BadgeCheck,
            title: "Review before submission",
            body: "Legal teams stay in control with a clear handoff from intake to draft review.",
          },
        ].map((item) => (
          <Card key={item.title} className="border-border/70 bg-card/70">
            <CardHeader className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <item.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{item.title}</CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <p className="text-sm uppercase tracking-[0.22em] text-accent-foreground">
              How it works
            </p>
            <CardTitle className="font-display text-3xl">
              A calmer intake process from first contact to final draft.
            </CardTitle>
            <CardDescription className="text-base">
              Casey is designed to keep the witness moving while giving the team
              enough structure to work efficiently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                step: "1",
                title: "Create the case and send the link",
                body: "Start from the case dashboard, choose the template, and issue a secure, expiring intake link.",
              },
              {
                step: "2",
                title: "Collect facts in plain language",
                body: "The witness answers conversational prompts while the system keeps the interview focused and complete.",
              },
              {
                step: "3",
                title: "Assemble and review the draft",
                body: "The platform turns the intake into a structured statement your team can review before submission.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-4 rounded-3xl border border-border/70 bg-background/70 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent-foreground">
                  {item.step}
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-foreground">{item.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <p className="text-sm uppercase tracking-[0.22em] text-accent-foreground">
                What you get
              </p>
              <CardTitle className="font-display text-3xl">
                The essentials legal teams care about.
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "Secure witness intake links",
                "Statement templates by case type",
                "Evidence capture and reminders",
                "Audit-friendly workflow controls",
                "Draft review before submission",
                "Protected document access and secure handling",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <p className="text-sm uppercase tracking-[0.22em] text-accent-foreground">
                Template system
              </p>
              <CardTitle className="font-display text-3xl">
                Reusable templates that keep output consistent.
              </CardTitle>
              <CardDescription className="text-base">
                Standardize witness intake and statement drafting across teams,
                while still adapting to different matter types.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "Case and statement templates that work together",
                "Configurable fields for firm-specific requirements",
                "Template variants by matter type and workflow",
                "Consistent draft structure across fee earners",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent-foreground" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="font-display text-3xl">
                Why firms choose Casey.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 leading-6 text-muted-foreground">
              <p>
                Capture better witness statements faster, with less fee-earner
                admin and a cleaner handoff to legal review.
              </p>
              <p>
                Casey guides witnesses through a structured intake so your team
                spends less time chasing missing details and more time advancing
                the case.
              </p>
              <p>
                The result: stronger first-pass drafts, faster turnaround, and
                fewer avoidable review cycles.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="waitlist">
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
                Join the waiting list to get product updates, onboarding
                previews, and access when the next cohort opens.
              </p>

              <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
                {[
                  "Product updates for legal teams",
                  "Preview access to new workflow tools",
                  "Onboarding for firms ready to pilot",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-accent-foreground" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8">
              <WaitlistSignupForm />
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
