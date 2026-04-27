import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Database,
  Eye,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Link2,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-title";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";

export const metadata = {
  title: `Security | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `Security overview for ${env.NEXT_PUBLIC_APP_NAME}, including access controls, witness links, audit logging, and data protection for UK legal practices.`,
};

const securityPrinciples = [
  {
    icon: ShieldCheck,
    title: "Designed for sensitive legal work",
    body: "Case files, witness accounts, draft statements, and exhibits can contain highly sensitive personal data. Casey is built around controlled access, clear accountability, and cautious defaults.",
  },
  {
    icon: LockKeyhole,
    title: "Firm-scoped at the database layer",
    body: "Casey uses Supabase row-level security policies so firm boundaries and role checks are enforced in the database, not only in the user interface.",
  },
  {
    icon: Fingerprint,
    title: "Auditable workflows",
    body: "Important activity across statement preparation, follow-up, final review, and administrative actions is designed to leave an operational trail.",
  },
] as const;

const controls = [
  {
    icon: UserCheck,
    title: "Role-based write controls",
    body: "Firm users are assigned roles such as firm admin, solicitor, or paralegal. Sensitive case, statement, magic-link, and storage writes are restricted by database policies to appropriate roles.",
  },
  {
    icon: Link2,
    title: "Time-bound witness links",
    body: "Witness intake is accessed through tokenised links tied to a specific statement, with expiry and state checks before sensitive actions proceed.",
  },
  {
    icon: ServerCog,
    title: "Server-side enforcement",
    body: "Public witness operations go through server-side routes that validate token scope, statement state, expected document paths, upload limits, and rate limits before privileged storage actions run.",
  },
  {
    icon: Database,
    title: "Scoped data access",
    body: "Application queries, RLS policies, and storage policies are designed to limit access to the correct firm, matter, statement, and document context.",
  },
  {
    icon: Eye,
    title: "Operational monitoring",
    body: "Request logging is sanitized to avoid bearer-token leakage, and audit-style event records help identify unexpected access patterns and reconstruct important workflow activity.",
  },
  {
    icon: FileCheck2,
    title: "Document safeguards",
    body: "Template and DOCX review tooling helps reduce errors in generated legal documents before they are published or used in live work.",
  },
] as const;

const witnessSafeguards = [
  "Privacy notice acknowledgement before the witness intake flow continues",
  "Token checks before interview, follow-up, evidence, and final-review actions",
  "Direct anonymous storage access removed from public witness flows",
  "Statement-specific storage path validation for evidence and signed documents",
  "Upload count, size, file-type, and persistent rate-limit controls for public evidence endpoints",
  "Statement-state validation to reduce accidental post-submission changes",
  "Final-review and follow-up routes separated from internal firm dashboards",
] as const;

const implementationNotes = [
  "Firm isolation is enforced with Supabase RLS policies for application tables and storage policies for organisation buckets.",
  "Paralegal, solicitor, firm-admin, and app-admin roles are not treated as interchangeable for write access.",
  "Witness links are bearer-style access tokens, so logs redact token-like path segments and public routes re-check token validity before each sensitive action.",
  "Uploaded evidence is stored only through server routes for public intake, with server-derived metadata and expected path prefixes.",
  "Data is not currently application-level encrypted before it is written to Supabase. Transport encryption, Supabase platform controls, RLS, and access controls are therefore important parts of the current model.",
  "Firms with a requirement for customer-managed keys or field-level encryption should raise that during security review before using the platform for highly sensitive matters.",
] as const;

const firmResponsibilities = [
  "Choose appropriate user roles and remove access when team members change matters or leave the firm",
  "Confirm the legal basis, privacy notices, retention rules, and client-care wording used for live matters",
  "Use strong identity practices for firm email accounts and devices used to access the platform",
  "Avoid sharing witness links outside the intended recipient and matter context",
  "Review exported documents before filing, serving, or relying on them",
  "Maintain internal policies for incident response, retention, supervision, and staff training",
] as const;

export default function SecurityPage() {
  const primaryCta = env.NEXT_PUBLIC_CALENDLY_LINK
    ? {
        href: env.NEXT_PUBLIC_CALENDLY_LINK,
        label: "Discuss security on a demo",
        external: true,
      }
    : { href: "/#beta", label: "Request early access", external: false };

  return (
    <>
      <section className="rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="max-w-4xl">
          <PageTitle
            subtitle="Security"
            title="Security for witness evidence, legal workflows, and firm data."
            description={`${env.NEXT_PUBLIC_APP_NAME} is designed for UK legal practices that handle sensitive witness statements and case material. This page explains the security posture, current platform controls, and shared responsibilities that support safer adoption.`}
            titleClassName="mt-4 text-4xl sm:text-5xl"
            descriptionClassName="mt-5 max-w-3xl text-base leading-7 sm:text-lg"
          />
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
              <Link href="/legal/privacy">Privacy policy</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-3">
        {securityPrinciples.map((item) => (
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
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8">
        <PageTitle
          subtitle="Controls"
          title="How Casey protects access and activity"
          description="Security is applied across the user, firm, matter, statement, and witness-link layers. The controls below are a high-level summary, not a substitute for a firm's own information security review."
          titleTag="h2"
          titleClassName="mt-2 text-3xl"
          descriptionClassName="mt-3 text-sm leading-6"
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {controls.map((item) => (
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

      <section className="mx-auto mt-24 max-w-6xl">
        <PageTitle
          subtitle="Implementation"
          title="What is enforced today"
          description="The controls below describe the current implementation rather than a future target state. They are intentionally specific so firms can evaluate whether the model fits their risk profile."
          titleTag="h2"
          className="mb-8"
          titleClassName="mt-2 text-3xl"
          descriptionClassName="mt-3 text-sm leading-6"
        />
        <Card className="mb-24 rounded-3xl bg-card/75">
          <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
            {implementationNotes.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <KeyRound className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 font-display text-2xl text-primary">
                Witness-link security model
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Witnesses do not need access to an internal legal dashboard.
                Instead, Casey uses scoped intake links for the task they have
                been invited to complete.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                This separation helps firms collect witness information while
                reducing exposure of unrelated cases, team dashboards, template
                settings, or administrative tools.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Witness intake safeguards
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {witnessSafeguards.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Shared responsibility with the legal practice
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Casey provides platform controls, but each firm remains
                responsible for how it configures access, instructs users, and
                applies its own professional, regulatory, and data-protection
                obligations.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {firmResponsibilities.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <Clock3 className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 text-lg text-foreground">
                Incident and vulnerability reporting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                If you believe you have found a security issue, please report it
                promptly and avoid accessing, modifying, or sharing any data
                that is not yours.
              </p>
              {env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`mailto:${env.NEXT_PUBLIC_SUPPORT_EMAIL}`}>
                    Email security contact
                  </Link>
                </Button>
              ) : (
                <p>
                  Contact the {env.NEXT_PUBLIC_APP_NAME} team through your
                  onboarding or support channel with a concise description,
                  affected URL, and reproduction steps where safe to provide.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-6xl">
        <Card className="rounded-3xl bg-card/85">
          <CardHeader>
            <CardTitle className="font-display text-2xl text-primary">
              Security review notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              This page describes the product&apos;s high-level security design.
              It does not guarantee that every possible risk has been removed,
              and it should be read alongside the firm&apos;s own policies,
              supplier due diligence, client obligations, and professional
              duties.
            </p>
            <p>
              Legal practices should confirm their own retention schedules,
              data-processing terms, privacy notices, and acceptable-use
              requirements before using the service for live matters.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
