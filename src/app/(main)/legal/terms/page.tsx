import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  FileCheck2,
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
  title: `Terms of Service | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `Terms of service for ${env.NEXT_PUBLIC_APP_NAME}, covering acceptable use, firm responsibilities, witness workflows, and platform limitations.`,
};

const highlights = [
  {
    icon: Scale,
    title: "For legal practice workflows",
    body: "Casey is provided for firms and authorised users managing witness intake, statements, documents, and related legal workflow activity.",
  },
  {
    icon: ShieldCheck,
    title: "Shared responsibility",
    body: "The platform provides controls and workflow tooling, while each firm remains responsible for matter supervision, legal advice, filing decisions, and user access.",
  },
  {
    icon: FileCheck2,
    title: "Review before relying",
    body: "Generated, drafted, exported, or assembled content should be checked by qualified legal professionals before it is filed, served, or relied on.",
  },
] as const;

const acceptableUse = [
  "Use the service only for lawful legal, administrative, and witness-management purposes",
  "Keep account credentials secure and remove users who no longer need access",
  "Share witness links only with the intended recipient and matter context",
  "Do not attempt to access data, accounts, links, files, or systems that are not assigned to you",
  "Do not upload malware, abusive material, or content that you are not authorised to process",
] as const;

const firmResponsibilities = [
  "Confirm authority to process witness, client, opponent, and third-party data",
  "Set appropriate privacy notices, retention rules, client-care wording, and matter instructions",
  "Review statements, exhibits, summaries, and generated documents before external use",
  "Maintain internal supervision, staff training, incident response, and professional compliance policies",
] as const;

const limitations = [
  "Casey is not a law firm and does not provide legal advice",
  "Platform outputs are workflow aids and should not replace professional judgement",
  "Access to beta, preview, or early-access functionality may change as the product develops",
  "Service availability may depend on hosting, identity, database, storage, email, and other third-party providers",
] as const;

export default function TermsPage() {
  return (
    <>
      <section className="rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="max-w-4xl">
          <PageTitle
            subtitle="Terms of service"
            title="Clear terms for using Casey in legal practice."
            description={`These terms explain the expected use of ${env.NEXT_PUBLIC_APP_NAME}, the responsibilities of firms and authorised users, and the limits of the platform. They should be read alongside any signed order form, data-processing terms, or written agreement with Casey.`}
            titleClassName="mt-4 text-4xl sm:text-5xl"
            descriptionClassName="mt-5 max-w-3xl text-base leading-7 sm:text-lg"
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild className="rounded-full px-7">
              <Link href="/legal/privacy">
                Privacy policy
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="rounded-full px-7"
            >
              <Link href="/legal/security">Security overview</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-3">
        {highlights.map((item) => (
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
          subtitle="Use rules"
          title="Acceptable use and firm responsibilities"
          description="Casey is intended for professional legal workflows. Firms control how the platform is configured, who is invited, and how matter data is reviewed and retained."
          titleTag="h2"
          titleClassName="mt-2 text-3xl"
          descriptionClassName="mt-3 text-sm leading-6"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Acceptable use
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {acceptableUse.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Firm responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {firmResponsibilities.map((item) => (
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
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-3xl bg-card/85">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Service limits
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                The platform supports legal workflows but does not make legal,
                evidential, procedural, or strategic decisions for the firm.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {limitations.map((item) => (
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
                <CircleAlert className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 text-lg text-foreground">
                Beta and early access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Early-access features may be updated, limited, suspended, or
                removed while Casey develops. Firms should avoid using preview
                functionality for live matters unless they have agreed the
                appropriate terms and risk controls.
              </p>
              <p>
                These public terms are a general summary and may be superseded
                by a signed agreement, order form, data-processing addendum, or
                other written terms agreed with Casey.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
