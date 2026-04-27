import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
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
  title: `GDPR Notice | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `High-level GDPR and UK data protection notice for ${env.NEXT_PUBLIC_APP_NAME}, built for legal practices handling witness statements.`,
};

const principles = [
  "Lawfulness, fairness, and transparency",
  "Purpose limitation and data minimisation",
  "Accuracy and storage limitation",
  "Integrity, confidentiality, and accountability",
] as const;

const platformSupport = [
  "Firm-scoped access for legal teams",
  "Time-bound, statement-specific witness links",
  "Audit-friendly statement, upload, submission, and follow-up records",
  "Configurable witness intake flows for different matters",
] as const;

const complianceAreas = [
  {
    icon: Scale,
    title: "Controller responsibility stays with the firm",
    body: "The firm determines the legal basis, privacy wording, matter retention, disclosure decisions, and responses to data subject rights.",
  },
  {
    icon: ShieldCheck,
    title: "Processor support from Casey",
    body: "Casey provides the hosted workflow, access controls, operational safeguards, and product records needed to process data on the firm's instructions.",
  },
  {
    icon: ClipboardCheck,
    title: "Evidence of notice",
    body: "Witness intake presents a privacy notice before the flow continues, and acknowledgement can be stored against the witness statement record.",
  },
] as const;

export default function GdprPage() {
  return (
    <>
      <section className="rounded-4xl border border-border/70 bg-background px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div className="max-w-4xl">
          <PageTitle
            subtitle="UK GDPR"
            title="Data protection support for legal witness workflows."
            description={`${env.NEXT_PUBLIC_APP_NAME} is designed for UK legal practices that process personal data in dispute handling, witness statements, and legal case management. This notice explains how the platform fits into a firm's own UK GDPR governance.`}
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
              <Link href="/legal/terms">Terms of service</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-6xl gap-4 lg:grid-cols-3">
        {complianceAreas.map((item) => (
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
          subtitle="Compliance model"
          title="Built to support, not replace, firm governance"
          description="Casey helps firms control access to data, keep records of activity, limit use to legitimate legal purposes, and reduce the chance of unauthorised disclosure."
          titleTag="h2"
          titleClassName="mt-2 text-3xl"
          descriptionClassName="mt-3 text-sm leading-6"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                UK GDPR principles
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {principles.map((item) => (
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
                How {env.NEXT_PUBLIC_APP_NAME} helps
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {platformSupport.map((item) => (
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
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <Card className="rounded-3xl bg-card/75">
            <CardHeader>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-foreground">
                <FileClock className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3 font-display text-2xl text-primary">
                Data subject rights
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                Requests should be handled by the firm that controls the
                relevant matter.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Depending on the legal basis and the firm&apos;s obligations, data
              subjects may have rights to access, rectify, erase, restrict,
              object to processing, or request portability.
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card/85">
            <CardHeader>
              <CardTitle className="font-display text-2xl text-primary">
                Firm responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Casey is a tool used by legal professionals to support data
                protection processes. It is not a substitute for the firm&apos;s
                own privacy notices, record of processing activities, retention
                rules, data-processing terms, or legal advice.
              </p>
              <p>
                Firms should confirm their own lawful basis, client-care
                wording, witness privacy notice, processor terms, transfer
                position, retention policy, and incident response process before
                using the service for live matters.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
