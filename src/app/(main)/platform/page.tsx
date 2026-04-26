import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Clock3,
  FileCheck2,
  FileCog,
  FileText,
  Fingerprint,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Users,
} from "lucide-react";

import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";

const pillars = [
  {
    icon: Link2,
    title: "Witness intake",
    body: "Open a secure, tokenised intake journey from the case. Witnesses acknowledge the privacy notice, answer guided questions, attach evidence, and submit a complete account.",
  },
  {
    icon: BrainCircuit,
    title: "AI-guided evidence capture",
    body: "The interview adapts to the witness account, asking for chronology, missing details, supporting documents, and clarification before formal drafting begins.",
  },
  {
    icon: FileText,
    title: "Statement drafting",
    body: "Turn the interview transcript into structured statement sections, then refine wording, order, and evidential clarity in the editor.",
  },
  {
    icon: FileCog,
    title: "Template governance",
    body: "Manage firm defaults, draft/published/archive states, DOCX placeholders, shared templates, and controlled publishing for repeatable statement quality.",
  },
  {
    icon: Users,
    title: "Team collaboration",
    body: "Keep case and statement notes, mentions, pinned context, notifications, and activity history beside the work they relate to.",
  },
  {
    icon: Fingerprint,
    title: "Security and compliance",
    body: "Support adoption with scoped access, audit-event coverage, lifecycle hooks, DSAR export support, and tenant boundaries.",
  },
] as const;

const teamViews = [
  {
    title: "Paralegals",
    body: "Launch intake, monitor outstanding work, request follow-up, and prepare cleaner drafts for review.",
  },
  {
    title: "Solicitors",
    body: "Review statement drafts with source context, refine the legal wording, and keep matter activity visible.",
  },
  {
    title: "Admins",
    body: "Control templates, users, firm settings, and governance policies from one operational surface.",
  },
] as const;

export default function PlatformPage() {
  const primaryCta = env.NEXT_PUBLIC_CALENDLY_LINK
    ? {
        href: env.NEXT_PUBLIC_CALENDLY_LINK,
        label: "Book a demo",
        external: true,
      }
    : { href: "/#beta", label: "Request early access", external: false };

  return (
    <main className="pb-20 pt-6 sm:pt-10">
      <section className="rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="max-w-4xl">
          <p className="text-sm uppercase text-accent-foreground">Platform</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-primary sm:text-5xl">
            A governed workspace for witness statement work.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {env.NEXT_PUBLIC_APP_NAME} connects witness intake, AI-assisted
            drafting, template controls, collaboration, and compliance support
            so firms can manage statement preparation as one workflow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
              <Link href="/legal/security">Security policy</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Capabilities"
          title="Built around the work legal teams actually do"
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {pillars.map((item) => (
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
          subtitle="Operating model"
          title="One workflow across intake, review, and follow-through"
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                From link to final review
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Casey keeps each stage connected: secure link issue, witness
                interview, evidence collection, AI formalization, inline review,
                follow-up, and final witness review.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                "Time-limited witness links",
                "Privacy acknowledgement before intake",
                "Evidence requests inside the interview",
                "Draft formalization with source context",
                "Follow-up and final-review channels",
                "Event history for operational oversight",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-accent-foreground" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Governance controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { icon: LockKeyhole, label: "Role-based access" },
                { icon: Fingerprint, label: "Audit-event coverage" },
                { icon: FileCheck2, label: "DOCX validation" },
                { icon: Clock3, label: "Lifecycle and reminders" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-accent-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8 sm:mt-28">
        <PageTitle
          subtitle="Teams"
          title="Clear surfaces for each role"
          titleTag="h2"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {teamViews.map((item) => (
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

      <section className="mx-auto mt-24 max-w-6xl">
        <Card className="rounded-3xl bg-card/85">
          <CardHeader>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <CardTitle className="mt-3 font-display text-2xl text-primary">
              Ready to map Casey to your intake process?
            </CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              Bring a real witness workflow, a template, or a current pain
              point. We will show how the platform handles it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-full">
              <Link
                href={primaryCta.href}
                target={primaryCta.external ? "_blank" : undefined}
                rel={primaryCta.external ? "noreferrer" : undefined}
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
