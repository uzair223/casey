import Link from "next/link";
import { ArrowRight, Building2, FileClock, Scale, ShieldCheck } from "lucide-react";

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
  title: `Data Processing Addendum | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `UK GDPR processor addendum draft for ${env.NEXT_PUBLIC_APP_NAME}. Have your solicitor review this before countersigning.`,
};

const categories = [
  "Witness identity, contact details, and interview transcripts",
  "Case metadata, statement drafts, exhibits, and signed documents",
  "Firm user accounts, roles, audit logs, and signature certificates",
] as const;

const subprocessors = [
  "Supabase — authentication, PostgreSQL, object storage",
  "Cloudflare Workers — application hosting and scheduled jobs",
  "Cloudflare AI Gateway — model inference for interview, formalization, analysis, and Jev decision scoring",
  "Resend — transactional email",
  "Stripe — seat subscription invoicing",
  "Self-hosted DocuSeal — certified electronic signature when enabled",
] as const;

const processorDuties = [
  "Process personal data only on the firm's documented instructions",
  "Apply technical and organisational measures described on the security page",
  "Assist with subject access, deletion, and retention after archive",
  "Delete or return tenant data when a soft-deleted organisation reaches its purge date",
] as const;

export default function DpaPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Data processing addendum"
        title="Processor terms for paid Casey workspaces."
        description={`${env.NEXT_PUBLIC_APP_NAME} processes witness and matter data as a processor for the instructing firm. This page is a working draft for solicitor review and is not a substitute for a signed DPA.`}
      >
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button size="lg" variant="brand" asChild className="rounded-full px-7">
            <Link href="/legal/gdpr">
              UK GDPR notice
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="rounded-full px-7"
          >
            <Link href="/legal/terms">Terms of service</Link>
          </Button>
        </div>
      </MarketingPageHero>

      <MarketingPageSection
        eyebrow="Roles"
        title="Controller, processor, and how data leaves the workspace."
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Reveal>
            <MarketingFeatureCard
              icon={<Scale className="h-4 w-4" />}
              title="Roles"
              body="The firm is the controller. Casey is the processor. Witnesses interact only through the firm's instructions and scoped intake links."
            />
          </Reveal>
          <Reveal delay={70}>
            <MarketingFeatureCard
              icon={<Building2 className="h-4 w-4" />}
              title="International transfers"
              body="Subprocessors may process data in the UK, EEA, or United States. Standard contractual clauses or equivalent safeguards apply where a restricted transfer is required."
            />
          </Reveal>
          <Reveal delay={140}>
            <MarketingFeatureCard
              icon={<FileClock className="h-4 w-4" />}
              title="Deletion"
              body="After an organisation is archived, Casey permanently deletes the tenant record when the organisation's retention period expires. Live matters are not auto-purged."
            />
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Schedule"
        title="Categories, subprocessors, and processor duties"
        description="Have your solicitor confirm this schedule before Casey marks a DPA as signed on the organisation."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <Reveal>
            <MarketingFeatureCard title="Data categories">
              <MarketingCheckList className="mt-6" items={categories} />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={70}>
            <MarketingFeatureCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Subprocessors"
            >
              <MarketingCheckList className="mt-6" items={subprocessors} />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={140}>
            <MarketingFeatureCard title="Processor duties">
              <MarketingCheckList className="mt-6" items={processorDuties} />
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageCta
        title="Ready to map Casey to your intake process?"
        description="Have your solicitor review this draft before countersigning. It should be read with the UK GDPR notice and terms of service."
      >
        <Link
          href="/legal/security"
          className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand"
        >
          Review the security policy
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </MarketingPageCta>
    </MarketingPage>
  );
}
