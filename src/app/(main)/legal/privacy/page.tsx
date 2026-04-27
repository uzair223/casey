import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Database,
  FileText,
  LockKeyhole,
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
  title: `Privacy Policy | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `Privacy policy for ${env.NEXT_PUBLIC_APP_NAME}, including how witness statement data is handled for UK legal practices.`,
};

const dataCategories = [
  "Witness identity and contact details",
  "Case references, matter metadata, and firm user details",
  "Statement responses, signed documents, attachments, and exhibits",
  "Audit metadata such as timestamps, access activity, and workflow state",
] as const;

const uses = [
  "Guide witness intake and prepare formal witness statements",
  "Help legal teams manage matters, evidence, follow-up, and review",
  "Secure, monitor, troubleshoot, and improve the service",
  "Support compliance, record keeping, retention, and accountability",
] as const;

const commitments = [
  {
    icon: UserCheck,
    title: "Controller and processor model",
    body: "The law firm using Casey remains the controller for the underlying matter. Casey acts as a processor on the firm's documented instructions for data hosted in the platform.",
  },
  {
    icon: LockKeyhole,
    title: "Restricted access",
    body: "Access to case data is restricted to authorised users within the relevant firm or organisation, with role-based controls and scoped witness links.",
  },
  {
    icon: Database,
    title: "Operational safeguards",
    body: "The service uses logging, database-level access controls, token checks, and public-route safeguards to reduce unauthorised access and support accountability.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <>
      <section className="rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="max-w-4xl">
          <PageTitle
            subtitle="Privacy policy"
            title="How Casey handles witness, case, and firm data."
            description={`${env.NEXT_PUBLIC_APP_NAME} is designed for UK legal practices that need to collect, review, and store witness statement data securely. This policy explains what data is processed, why it is used, and how responsibility is shared with the firm using the platform.`}
            titleClassName="mt-4 text-4xl sm:text-5xl"
            descriptionClassName="mt-5 max-w-3xl text-base leading-7 sm:text-lg"
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild className="rounded-full px-7">
              <Link href="/legal/gdpr">
                Read the UK GDPR notice
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
        {commitments.map((item) => (
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
          subtitle="Personal data"
          title="What is collected and how it is used"
          description="Casey only processes personal data to provide the service, support legal case handling, and meet contractual, security, and compliance obligations."
          titleTag="h2"
          titleClassName="mt-2 text-3xl"
          descriptionClassName="mt-3 text-sm leading-6"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 text-lg text-foreground">
                Data we process
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {dataCategories.map((item) => (
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
                <ArrowRight className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 text-lg text-foreground">
                How data is used
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {uses.map((item) => (
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
        <Card className="rounded-3xl bg-card/85">
          <CardHeader>
            <CardTitle className="font-display text-2xl text-primary">
              Retention, sharing, and witness rights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              Data should only be retained for as long as necessary for the
              legal matter, the firm&apos;s retention policy, contractual
              obligations, or other applicable legal requirements. Casey does
              not sell witness data.
            </p>
            <p>
              We only share data with service providers and legal users where
              that is needed to operate the service, secure the platform, or
              support the firm&apos;s instructions. For witness intake, Casey
              shows a privacy notice before the witness can proceed, and that
              acknowledgement can be recorded against the statement.
            </p>
            <p>
              If you are a witness and want to understand how your personal data
              is handled, please contact the firm that invited you. If you are a
              legal practice evaluating {env.NEXT_PUBLIC_APP_NAME}, review this
              policy alongside your own privacy notices, client-care wording,
              retention rules, and supplier due-diligence process.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
