import Link from "next/link";
import { ArrowRight, Database, FileText, LockKeyhole, UserCheck } from "@/components/icons";

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
  title: `Privacy Policy | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `Privacy policy for ${env.NEXT_PUBLIC_APP_NAME}, including how enquiry and account data is handled for UK legal practices.`,
};

const dataCategories = [
  "Identity and contact details given in an enquiry or account",
  "Case references, matter metadata, and firm user details",
  "Statement responses, signed documents, attachments, and exhibits",
  "Audit metadata such as timestamps, access activity, and workflow state",
] as const;

const uses = [
  "Qualify an enquiry, take the fuller account after accept, and support the written draft during review",
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
    body: "Access to lead data is restricted to authorised users within the relevant firm or organisation, with role-based controls and private account links.",
  },
  {
    icon: Database,
    title: "Operational safeguards",
    body: "The service uses logging, database-level access controls, token checks, and public-route safeguards to reduce unauthorised access and support accountability.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Privacy policy"
        title="How Casey handles enquiry, account, and firm data."
        description={`${env.NEXT_PUBLIC_APP_NAME} is the firm's first contact. A short chat qualifies the enquiry. After the firm accepts, the fuller account, evidence, and other people come in. This policy explains what data is processed, why it is used, and how responsibility is shared with the firm.`}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" variant="brand" asChild className="rounded-full px-7">
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
      </MarketingPageHero>

      <MarketingPageSection
        eyebrow="Commitments"
        title="How responsibility is shared."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {commitments.map((item, index) => (
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
        eyebrow="Personal data"
        title="What is collected and how it is used"
        description="Casey only processes personal data to provide the service, support legal case handling, and meet contractual, security, and compliance obligations."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <MarketingFeatureCard
              icon={<FileText className="h-4 w-4" />}
              title="Data we process"
            >
              <MarketingCheckList className="mt-6" items={dataCategories} />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard
              icon={<ArrowRight className="h-4 w-4" />}
              title="How data is used"
            >
              <MarketingCheckList className="mt-6" items={uses} />
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Rights"
        title="Retention, sharing, and individual rights"
      >
        <Reveal>
          <MarketingFeatureCard title="What stays with the firm">
            <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                Data should only be retained for as long as necessary for the
                legal matter, the firm&apos;s retention policy, contractual
                obligations, or other applicable legal requirements. Casey does
                not sell personal data collected for a lead.
              </p>
              <p>
                We only share data with service providers and legal users where
                that is needed to operate the service, secure the platform, or
                support the firm&apos;s instructions. Before an account
                continues, Casey shows a privacy notice, and that
                acknowledgement can be recorded against the account.
              </p>
              <p>
                If you gave an account and want to understand how your personal
                data is handled, please contact the firm that sent the link. If
                you are a legal practice evaluating {env.NEXT_PUBLIC_APP_NAME},
                review this policy alongside your own privacy notices,
                client-care wording, retention rules, and supplier
                due-diligence process.
              </p>
            </div>
          </MarketingFeatureCard>
        </Reveal>
      </MarketingPageSection>

      <MarketingPageCta
        title="Ready to map Casey to your intake process?"
        description="Read this policy alongside the security overview and your own notices before using the service for live matters."
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
