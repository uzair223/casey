import Link from "next/link";

import { ArrowRight } from "@/components/icons";
import { AboutInterviewVisual } from "@/components/marketing/about-visual";
import {
  MarketingPage,
  MarketingPageCta,
  MarketingPageHero,
  MarketingPageSection,
} from "@/components/marketing/page";
import { env } from "@/lib/env";

export const metadata = {
  title: `Platform | ${env.NEXT_PUBLIC_APP_NAME}`,
  description:
    "Casey interviews witnesses, gathers evidence and finds what's missing, so your solicitors start with a review-ready first draft.",
};

const pillars = [
  {
    label: "Intake",
    title: "Fill the gaps",
    body: "Send a private link from the matter. Casey interviews the witness, asks the follow-up questions, and collects supporting evidence while the account is still coming in.",
  },
  {
    label: "Capture",
    title: "The next useful question.",
    body: "The interview asks for chronology, missing details, and supporting documents before anyone on your team has to follow up.",
  },
  {
    label: "Draft",
    title: "Turn the evidence into a first draft",
    body: "Interviews, transcripts and exhibits are condensed into a statement. Your solicitors tweak it instead of writing from scratch.",
  },
  {
    label: "Gaps",
    title: "Find what's missing before review",
    body: "Chronology, conflicting accounts and missing evidence sit beside the draft, so solicitors see the gaps before they sit down.",
  },
  {
    label: "Review",
    title: "Start from a statement you can mark up",
    body: "Wording, source context and exhibits stay together. Review is markup, not reconstruction.",
  },
  {
    label: "Team",
    title: "Give solicitors more time for their best thinking",
    body: "Outstanding witness work, notes and a trail of what happened stay on the matter. Judgement stays with you.",
  },
] as const;

const roles = [
  {
    title: "Paralegals",
    body: "Send the link, watch the account come in, and hand over a first draft instead of outstanding questions.",
  },
  {
    title: "Solicitors",
    body: "Review a statement with the evidence and the gaps in view. Spend the time on judgement.",
  },
  {
    title: "Admins",
    body: "Keep templates, users and access in one place.",
  },
] as const;

export default function PlatformPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Platform"
        title="Ask. Gather. Find the gaps. Draft."
        description="Casey interviews witnesses, gathers evidence and finds what's missing, so your solicitors start with a review-ready first draft."
      />

      <MarketingPageSection eyebrow="What Casey does">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <ol className="border-t border-primary/15">
            {pillars.map((item, index) => (
              <li
                key={item.title}
                className="grid gap-3 border-b border-primary/15 py-8 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-6"
              >
                <p className="font-display text-3xl text-brand">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <div>
                  <p className="font-display text-lg italic text-brand">
                    {item.label}
                  </p>
                  <h3 className="mt-1 text-2xl leading-snug text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="lg:sticky lg:top-28">
            <AboutInterviewVisual />
          </div>
        </div>
      </MarketingPageSection>

      <MarketingPageSection
        eyebrow="From link to review"
        title="Casey asks the follow-up questions, collects supporting evidence, spots missing information before review, and turns everything into a review-ready first draft."
      />

      <MarketingPageSection
        eyebrow="Teams"
        title="Give solicitors more time for their best thinking."
      >
        <ul className="border-t border-primary/15">
          {roles.map((item) => (
            <li
              key={item.title}
              className="grid gap-2 border-b border-primary/15 py-6 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8"
            >
              <h3 className="text-xl text-primary">{item.title}</h3>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </MarketingPageSection>

      <MarketingPageCta
        title="Your solicitors deserve their best thinking."
        description="Bring a matter. We will show where Casey takes that work off your team."
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
