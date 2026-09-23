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
    "One lead, from the public page to review: the feed, the account, the exhibits, and the gap list.",
};

const pillars = [
  {
    label: "Intake",
    title: "A page for each lead type",
    body: "Personal injury, accident at work, clinical negligence: each type has its own questions. Several types can share one link.",
  },
  {
    label: "Decision",
    title: "A feed of finished enquiries",
    body: "Accept a lead onto the file, or decline it with a reason the firm wrote. Half-finished chats stay out of the feed.",
  },
  {
    label: "Evidence",
    title: "Exhibits travel with the account",
    body: "Photos, treatment records, and the other people on the matter are requested once you accept.",
  },
  {
    label: "Gaps",
    title: "Conflicts show up early",
    body: "Missing dates, unsupported detail, and documents that were never sent are marked on the lead.",
  },
  {
    label: "Draft",
    title: "The statement is written in review",
    body: "Solicitors prepare the draft with the account and the exhibits beside it.",
  },
  {
    label: "Team",
    title: "Seats come with the plan",
    body: "Trial includes 5 seats. Starter includes 10. Growth includes unlimited seats.",
  },
] as const;

const roles = [
  {
    title: "Paralegals",
    body: "Work the feed, accept what fits, and chase the exhibits that are still outstanding.",
  },
  {
    title: "Solicitors",
    body: "Open a lead that already has an account, exhibits, and a gap list. Spend the hour on the draft.",
  },
  {
    title: "Admins",
    body: "Publish lead types, set the hosted page, and invite the team. Seats are included with the plan.",
  },
] as const;

export default function PlatformPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Platform"
        title="One lead, from the public page to review."
        description="The feed, the account, the exhibits, and the gap list stay on the same matter. Paralegals, solicitors, and admins work from that file."
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
        eyebrow="On the file"
        title="Accept it, and the rest of the matter stays attached."
        description="A photo, the other person's name, and the missing treatment date sit on the same lead as the account."
      />

      <MarketingPageSection
        eyebrow="Teams"
        title="Same lead. A different job for each role."
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
        title="Bring one enquiry. See the file."
        description="We will run it through Casey and show what lands in front of the team."
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
