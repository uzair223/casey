import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Database,
  Eye,
  FileCheck2,
  KeyRound,
  Link2,
  ServerCog,
  UserCheck,
} from "@/components/icons";

import {
  MarketingCheckList,
  MarketingFeatureCard,
  MarketingPage,
  MarketingPageCta,
  MarketingPageHero,
  MarketingPageSection,
} from "@/components/marketing/page";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

export const metadata = {
  title: `Security | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `How ${env.NEXT_PUBLIC_APP_NAME} protects enquiry and account data, including firm-scoped access, tokenised links, audit logging, and UK legal practice controls.`,
};

const securityPrinciples = [
  {
    label: "Privacy",
    title: "Designed for sensitive legal work",
    body: "Lead files, accounts, written drafts, and exhibits can contain highly sensitive personal data. Casey is built around controlled access, clear accountability, and cautious defaults.",
  },
  {
    label: "Access",
    title: "Firm-scoped at the database layer",
    body: "Casey uses Supabase row-level security policies so firm boundaries and role checks are enforced in the database, not only in the user interface.",
  },
  {
    label: "Audit",
    title: "A trail you can explain",
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
    title: "Time-bound account links",
    body: "The fuller account is accessed through tokenised links tied to one person, with expiry and state checks before sensitive actions proceed.",
  },
  {
    icon: ServerCog,
    title: "Server-side enforcement",
    body: "Public account operations go through server-side routes that validate token scope, account state, expected document paths, upload limits, and rate limits before privileged storage actions run.",
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
  "Privacy notice acknowledgement before the account continues",
  "Token checks before interview, follow-up, evidence, and final-review actions",
  "Direct anonymous storage access removed from public account flows",
  "Statement-specific storage path validation for evidence and signed documents",
  "Upload count, size, file-type, and persistent rate-limit controls for public evidence endpoints",
  "Statement-state validation to reduce accidental post-submission changes",
  "Final-review and follow-up routes separated from internal firm dashboards",
] as const;

const implementationNotes = [
  "Firm isolation is enforced with Supabase RLS policies for application tables and storage policies for organisation buckets.",
  "Paralegal, solicitor, firm-admin, and app-admin roles are not treated as interchangeable for write access.",
  "Account links are bearer-style access tokens, so logs redact token-like path segments and public routes re-check token validity before each sensitive action.",
  "Uploaded evidence is stored only through server routes for public intake, with server-derived metadata and expected path prefixes.",
  "Data is not currently application-level encrypted before it is written to Supabase. Transport encryption, Supabase platform controls, RLS, and access controls are therefore important parts of the current model.",
  "Firms with a requirement for customer-managed keys or field-level encryption should raise that during security review before using the platform for highly sensitive matters.",
  "Interview replies and analysis prose are generated through Cloudflare AI Gateway. Jev scores interview routing and case-analysis completeness or contradictions through Cloudflare's typesafe/jev model. Jev is fail-open: if scoring is unavailable, Casey continues with the LLM path.",
] as const;

const firmResponsibilities = [
  "Choose appropriate user roles and remove access when team members change matters or leave the firm",
  "Confirm the legal basis, privacy notices, retention rules, and client-care wording used for live matters",
  "Use strong identity practices for firm email accounts and devices used to access the platform",
  "Avoid sharing account links outside the intended recipient and matter context",
  "Review exported documents before filing, serving, or relying on them",
  "Maintain internal policies for incident response, retention, supervision, and staff training",
] as const;

export default function SecurityPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Security & privacy"
        title="Enquiry data deserves the highest protection."
        description={`${env.NEXT_PUBLIC_APP_NAME} is built for UK firms handling sensitive accounts and lead files. This page covers the current controls, limits, and shared responsibilities.`}
        footer={
          <Link
            href="/legal/privacy"
            className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand"
          >
            Read the privacy policy
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <MarketingPageSection
        eyebrow="Approach"
        title="Privacy, access, and a trail you can explain."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {securityPrinciples.map((item, index) => (
            <Reveal key={item.title} delay={index * 70}>
              <MarketingFeatureCard
                label={item.label}
                title={item.title}
                body={item.body}
              />
            </Reveal>
          ))}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Controls"
        title="How Casey protects access and activity"
        description="Security is applied across the user, firm, lead, account, and private-link layers. The controls below are a high-level summary, not a substitute for a firm's own information security review."
      >
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {controls.map((item, index) => (
            <Reveal key={item.title} delay={index * 70}>
              <MarketingFeatureCard
                icon={<item.icon className="h-4 w-4" />}
                title={item.title}
                body={item.body}
              />
            </Reveal>
          ))}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Implementation"
        title="What is enforced today"
        description="The controls below describe the current implementation rather than a future target state. They are intentionally specific so firms can evaluate whether the model fits their risk profile."
      >
        <Reveal>
          <MarketingFeatureCard title="Current model">
            <MarketingCheckList className="mt-6" items={implementationNotes} />
          </MarketingFeatureCard>
        </Reveal>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Account links"
        title="An account without opening the rest of the file."
        description="People giving an account do not need access to an internal legal dashboard. Casey uses a private link for that account."
      >
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <MarketingFeatureCard
              icon={<KeyRound className="h-4 w-4" />}
              title="Account-link security model"
              body="This separation helps firms collect an account while reducing exposure of unrelated leads, team dashboards, template settings, or administrative tools."
            />
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard title="Account safeguards">
              <MarketingCheckList className="mt-6" items={witnessSafeguards} />
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Shared responsibility"
        title="Platform controls, practice obligations."
        description="Casey provides platform controls, but each firm remains responsible for how it configures access, instructs users, and applies its own professional, regulatory, and data-protection obligations."
      >
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal>
            <MarketingFeatureCard title="What the firm owns">
              <MarketingCheckList
                className="mt-6"
                items={firmResponsibilities}
              />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard
              icon={<Clock3 className="h-4 w-4" />}
              title="Incident and vulnerability reporting"
              body="If you believe you have found a security issue, please report it promptly and avoid accessing, modifying, or sharing any data that is not yours."
            >
              <div className="mt-6">
                {env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`mailto:${env.NEXT_PUBLIC_SUPPORT_EMAIL}`}>
                      Email security contact
                    </Link>
                  </Button>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Contact the {env.NEXT_PUBLIC_APP_NAME} team through your
                    onboarding or support channel with a concise description,
                    affected URL, and reproduction steps where safe to provide.
                  </p>
                )}
              </div>
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageCta
        title="Ready to map Casey to your intake process?"
        description="This page describes the product's high-level security design. Read it alongside your own policies, supplier due diligence, and professional duties before using the service for live matters."
      >
        <Link
          href="/platform"
          className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand"
        >
          See how the platform works
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </MarketingPageCta>
    </MarketingPage>
  );
}
