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
  description:
    "Casey interviews witnesses, gathers evidence and finds what's missing, so your solicitors start with a review-ready first draft.",
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
    title: "Fill the gaps before you have to chase",
    body: "Send a private link from the matter. Casey interviews the witness, asks the follow-up questions, and collects supporting evidence while the account is still coming in.",
    span: "md:col-span-4 md:row-span-2",
    visual: "intake",
  },
  {
    label: "Capture",
    title: "The next useful question, not another chase",
    body: "The interview asks for chronology, missing details, and supporting documents before anyone on your team has to follow up.",
    span: "md:col-span-2",
    visual: "capture",
  },
  {
    label: "Draft",
    title: "Turn the evidence into a first draft",
    body: "Interviews, transcripts and exhibits are condensed into a statement. Your solicitors tweak it instead of writing from scratch.",
    span: "md:col-span-2",
    visual: "drafting",
  },
  {
    label: "Gaps",
    title: "Find what's missing before review",
    body: "Chronology, conflicting accounts and missing evidence sit beside the draft, so solicitors see the gaps before they sit down.",
    span: "md:col-span-3",
    visual: "timeline",
  },
  {
    label: "Review",
    title: "Start from a statement you can mark up",
    body: "Wording, source context and exhibits stay together. Review is markup, not reconstruction.",
    span: "md:col-span-3",
    visual: "templates",
  },
  {
    label: "Team",
    title: "Give solicitors more time for their best thinking",
    body: "Outstanding witness work, notes and a trail of what happened stay on the matter. Judgement stays with you. The chasing does not.",
    span: "md:col-span-6",
    visual: "team",
  },
];

const roles = [
  {
    title: "Paralegals",
    body: "Send the link, watch the account come in, and hand over a first draft instead of a chase list.",
  },
  {
    title: "Solicitors",
    body: "Review a statement with the evidence and the gaps in view. Spend the time on judgement.",
  },
  {
    title: "Admins",
    body: "Keep templates, users and access in one place so the chasing does not leak into inboxes.",
  },
] as const;

export default function PlatformPage() {
  return (
    <MarketingPage accent="green">
      <MarketingPageHero
        eyebrow="Platform"
        title="Witness statements without the chasing."
        description="Casey interviews witnesses, gathers evidence and finds what's missing, so your solicitors start with a review-ready first draft."
      />

      <MarketingPageSection
        eyebrow="What Casey does"
        title="Casey removes the chasing from witness statements."
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
        eyebrow="From link to review"
        title="Ask. Gather. Find the gaps. Draft."
        description="Casey asks the follow-up questions, collects supporting evidence, spots missing information before review, and turns everything into a review-ready first draft."
      />

      <MarketingPageSection
        eyebrow="Teams"
        title="Give solicitors more time for their best thinking."
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
        title="Your solicitors deserve their best thinking, not more chasing."
        description="Bring a matter that still needs chasing. We will show where Casey takes that work off your team."
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
