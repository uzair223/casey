import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  FileCheck2,
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
  "Paid seats are billed monthly in advance for the licensed user count on the order form",
  "Fees are non-refundable except where required by law; unpaid invoices may suspend the workspace",
  "Liability is limited to the fees paid for the affected subscription period, except for death, personal injury, or fraud",
] as const;

export default function TermsPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Terms of service"
        title="Clear terms for using Casey in legal practice."
        description={`These terms explain the expected use of ${env.NEXT_PUBLIC_APP_NAME}, the responsibilities of firms and authorised users, and the limits of the platform. They should be read alongside any signed order form, data-processing terms, or written agreement with Casey.`}
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
        eyebrow="Highlights"
        title="What using Casey means for a firm."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {highlights.map((item, index) => (
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
        eyebrow="Use rules"
        title="Acceptable use and firm responsibilities"
        description="Casey is intended for professional legal workflows. Firms control how the platform is configured, who is invited, and how matter data is reviewed and retained."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <MarketingFeatureCard title="Acceptable use">
              <MarketingCheckList className="mt-6" items={acceptableUse} />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard title="Firm responsibilities">
              <MarketingCheckList className="mt-6" items={firmResponsibilities} />
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Limits"
        title="The platform supports the work. It does not replace it."
      >
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <MarketingFeatureCard
              title="Service limits"
              body="The platform supports legal workflows but does not make legal, evidential, procedural, or strategic decisions for the firm."
            >
              <MarketingCheckList className="mt-6" items={limitations} />
            </MarketingFeatureCard>
          </Reveal>
          <Reveal delay={90}>
            <MarketingFeatureCard
              icon={<CircleAlert className="h-4 w-4" />}
              title="Beta and early access"
            >
              <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  Early-access features may be updated, limited, suspended, or
                  removed while Casey develops. Firms should avoid using preview
                  functionality for live matters unless they have agreed the
                  appropriate terms and risk controls.
                </p>
                <p>
                  These public terms are a general summary and may be superseded
                  by a signed agreement, order form, data-processing addendum,
                  or other written terms agreed with Casey. Paid workspaces are
                  billed per licensed seat. Generated content must be reviewed
                  by a qualified legal professional before it is filed or relied
                  on.
                </p>
              </div>
            </MarketingFeatureCard>
          </Reveal>
        </div>
      </MarketingPageSection>

      <MarketingPageCta
        title="Ready to map Casey to your intake process?"
        description="These terms should be read alongside any signed order form, data-processing terms, or written agreement with Casey."
      >
        <Link
          href="/legal/privacy"
          className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand"
        >
          Read the privacy policy
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </MarketingPageCta>
    </MarketingPage>
  );
}
