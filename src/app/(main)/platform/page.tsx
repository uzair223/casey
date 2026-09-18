import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BentoCard } from "@/components/marketing/bento";
import {
  platformVisuals,
  type PlatformVisualKind,
} from "@/components/marketing/platform-visuals";
import {
  MarketingFeatureCard,
  MarketingPage,
  MarketingPageCta,
  MarketingPageHero,
  MarketingPageSection,
} from "@/components/marketing/page";
import { Reveal } from "@/components/marketing/reveal";
import { env } from "@/lib/env";

export const metadata = {
  title: `Platform | ${env.NEXT_PUBLIC_APP_NAME}`,
  description: `${env.NEXT_PUBLIC_APP_NAME} connects witness intake, drafting, evidence, and case intelligence so statement work lives in one place.`,
};

const pillars: {
  label: string;
  title: string;
  body: string;
  span: string;
  visual: PlatformVisualKind;
}[] = [
  {
    label: "Intake",
    title: "A secure link, not another inbox thread",
    body: "Open a time-limited journey from the matter. Witnesses acknowledge the privacy notice, answer guided questions, and attach evidence as the account develops.",
    span: "md:col-span-4 md:row-span-2",
    visual: "intake",
  },
  {
    label: "Capture",
    title: "Questions that know what a lawyer needs next",
    body: "The interview adapts to the account, asking for chronology, missing details, and supporting documents before anyone starts drafting.",
    span: "md:col-span-2",
    visual: "capture",
  },
  {
    label: "Drafting",
    title: "A first draft with the source still attached",
    body: "Turn the transcript into structured statement sections, then refine wording in the editor without losing the evidence trail.",
    span: "md:col-span-2",
    visual: "drafting",
  },
  {
    label: "Intelligence",
    title: "See the file, not just the narrative",
    body: "Chronology, agreed facts, disputes, missing information, and exhibit references sit beside the draft.",
    span: "md:col-span-3",
    visual: "timeline",
  },
  {
    label: "Templates",
    title: "Firm standards, not a blank page",
    body: "Manage defaults, publishing, DOCX placeholders, and shared templates so every matter starts from the same quality bar.",
    span: "md:col-span-3",
    visual: "templates",
  },
  {
    label: "Team",
    title: "Notes, mentions, and a trail of what happened",
    body: "Keep collaboration next to the statement it relates to, with notifications and activity history for the people who need them.",
    span: "md:col-span-6",
    visual: "team",
  },
];

const roles = [
  {
    title: "Paralegals",
    body: "Launch intake, watch outstanding work, request follow-up, and hand over a cleaner draft.",
  },
  {
    title: "Solicitors",
    body: "Review with source context, inspect chronology and gaps, and mark up the legal wording.",
  },
  {
    title: "Admins",
    body: "Control templates, users, and governance from one operational surface.",
  },
] as const;

export default function PlatformPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Platform"
        title="A workspace for witness evidence, not another drafting tool."
        description={`${env.NEXT_PUBLIC_APP_NAME} connects intake, drafting, evidence, case analysis, templates, and review so statement work lives in one place.`}
      />

      <MarketingPageSection
        eyebrow="Capabilities"
        title="Built around the work legal teams already do."
      >
        <div className="grid gap-5 md:grid-cols-6">
          {pillars.map((item, index) => {
            const Visual = platformVisuals[item.visual];
            return (
              <Reveal key={item.title} delay={index * 70} className={item.span}>
                <BentoCard className="flex h-full min-h-[22rem] flex-col p-0">
                  <Visual />
                  <div className="space-y-3 p-8 pt-2 sm:p-10 sm:pt-2">
                    <p className="text-sm text-brand">{item.label}</p>
                    <h3 className="text-2xl leading-snug text-primary">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-7 text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </BentoCard>
              </Reveal>
            );
          })}
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="Operating model"
        title="One workflow from link to final review."
        description="Secure link, interview, evidence, first draft, analysis, follow-up, and witness review stay connected. Nothing important lives only in someone's inbox."
      />

      <MarketingPageSection
        eyebrow="Teams"
        title="Clear surfaces for each role."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {roles.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <MarketingFeatureCard title={item.title} body={item.body} />
            </Reveal>
          ))}
        </div>
      </MarketingPageSection>

      <MarketingPageCta
        title="Ready to map Casey to your intake process?"
        description="Bring a real witness workflow, a template, or a current pain point. We will show how the platform handles it."
      >
        <Link
          href="/legal/security"
          className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand"
        >
          Or read the security policy
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </MarketingPageCta>
    </MarketingPage>
  );
}
