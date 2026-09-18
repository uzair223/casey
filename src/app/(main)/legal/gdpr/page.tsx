import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FileClock,
  Scale,
  ShieldCheck,
} from "lucide-react";

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
    <MarketingPage>
      <MarketingPageHero
        eyebrow="UK GDPR"
        title="Data protection support for legal witness workflows."
        description={`${env.NEXT_PUBLIC_APP_NAME} is designed for UK legal practices that process personal data in dispute handling, witness statements, and legal case management. This notice explains how the platform fits into a firm's own UK GDPR governance.`}
      >
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button size="lg" variant="brand" asChild className="rounded-full px-7">
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
            <Link href="/legal/dpa">Data processing addendum</Link>
          </Button>
        </div>
      </MarketingPageHero>

      <MarketingPageSection
        eyebrow="Roles"
        title="Controller, processor, and a recorded notice."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {complianceAreas.map((item, index) => (
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
        eyebrow="Compliance model"
        title="Built to support, not replace, firm governance"
        description="Casey helps firms control access to data, keep records of activity, limit use to legitimate legal purposes, and reduce the chance of unauthorised disclosure."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <MarketingFeatureCard title="UK GDPR principles">
              <MarketingCheckList className="mt-6" items={principles} />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard title={`How ${env.NEXT_PUBLIC_APP_NAME} helps`}>
              <MarketingCheckList className="mt-6" items={platformSupport} />
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Rights"
        title="Requests sit with the firm that controls the matter."
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <MarketingFeatureCard
              icon={<FileClock className="h-4 w-4" />}
              title="Data subject rights"
              body="Depending on the legal basis and the firm's obligations, data subjects may have rights to access, rectify, erase, restrict, object to processing, or request portability."
            />
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard title="Firm responsibilities">
              <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  Casey is a tool used by legal professionals to support data
                  protection processes. It is not a substitute for the
                  firm&apos;s own privacy notices, record of processing
                  activities, retention rules, data-processing terms, or legal
                  advice.
                </p>
                <p>
                  Firms should confirm their own lawful basis, client-care
                  wording, witness privacy notice, processor terms, transfer
                  position, retention policy, and incident response process
                  before using the service for live matters.
                </p>
              </div>
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageCta
        title="Ready to map Casey to your intake process?"
        description="This notice explains how Casey fits a firm's UK GDPR governance. It should be read with the privacy policy and DPA."
      >
        <Link
          href="/legal/dpa"
          className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand"
        >
          Read the data processing addendum
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </MarketingPageCta>
    </MarketingPage>
  );
}
