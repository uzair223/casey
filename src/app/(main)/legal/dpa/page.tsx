import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileClock,
  Scale,
  ShieldCheck,
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
  "Resend — transactional email",
  "OpenRouter — model inference for interview, formalization, and analysis",
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
    <>
      <section className="rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="max-w-4xl">
          <PageTitle
            subtitle="Data processing addendum"
            title="Processor terms for paid Casey workspaces."
            description={`${env.NEXT_PUBLIC_APP_NAME} processes witness and matter data as a processor for the instructing firm. This page is a working draft for solicitor review and is not a substitute for a signed DPA.`}
            titleClassName="mt-4 text-4xl sm:text-5xl"
            descriptionClassName="mt-5 max-w-3xl text-base leading-7 sm:text-lg"
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild className="rounded-full px-7">
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
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-3">
        <Card className="rounded-3xl bg-card/75">
          <CardHeader>
            <Scale className="h-5 w-5" />
            <CardTitle className="mt-3 text-lg">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-6">
              The firm is the controller. Casey is the processor. Witnesses
              interact only through the firm&apos;s instructions and scoped
              intake links.
            </CardDescription>
          </CardContent>
        </Card>
        <Card className="rounded-3xl bg-card/75">
          <CardHeader>
            <Building2 className="h-5 w-5" />
            <CardTitle className="mt-3 text-lg">International transfers</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-6">
              Subprocessors may process data in the UK, EEA, or United States.
              Standard contractual clauses or equivalent safeguards apply where
              a restricted transfer is required.
            </CardDescription>
          </CardContent>
        </Card>
        <Card className="rounded-3xl bg-card/75">
          <CardHeader>
            <FileClock className="h-5 w-5" />
            <CardTitle className="mt-3 text-lg">Deletion</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm leading-6">
              After an organisation is archived, Casey permanently deletes the
              tenant record when the organisation&apos;s retention period
              expires. Live matters are not auto-purged.
            </CardDescription>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto mt-24 max-w-6xl space-y-8">
        <PageTitle
          subtitle="Schedule"
          title="Categories, subprocessors, and processor duties"
          description="Have your solicitor confirm this schedule before Casey marks a DPA as signed on the organisation."
          titleTag="h2"
          titleClassName="mt-2 text-3xl"
          descriptionClassName="mt-3 text-sm leading-6"
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle>Data categories</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {categories.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle>Subprocessors</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {subprocessors.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle>Processor duties</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {processorDuties.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
