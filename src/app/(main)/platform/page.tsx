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
    "What a firm sees in Casey, from the first enquiry to the signed statement.",
};

const pillars = [
  {
    label: "Enquiry",
    title: "The enquiry page",
    body: "One address for the firm. Personal injury, accident at work, and clinical negligence come ready to use, and firms build their own lead types and account templates in Settings. Casey confirms each contact with a short code.",
  },
  {
    label: "Leads",
    title: "The leads list",
    body: "New leads show the lead type, the enquirer's details, and who is assigned. Solicitors and admins accept, or decline with the reason recorded. Paralegals add enquiries that came in by phone.",
  },
  {
    label: "Account",
    title: "Accounts",
    body: "After accept, claimants get a private link, give their accounts in stages, upload photos and records, and check everything before sending.",
  },
  {
    label: "Others",
    title: "Witnesses",
    body: "When accounts arrive, Casey lists the colleagues, witnesses, or family named in them. The firm chooses who to ask, and each gets their own link.",
  },
  {
    label: "Facts",
    title: "Facts and gaps",
    body: "One click produces a summary, a chronology, the agreed facts, the conflicts, and the gaps across every account on the file.",
  },
  {
    label: "Draft",
    title: "Statements",
    body: "Solicitors write them in review with the accounts and documents alongside, request follow-up where something is missing, and send them for signature.",
  },
] as const;

const roles = [
  {
    title: "Paralegals",
    body: "See every lead, add walk-in and phone enquiries, and keep an eye on accounts that are still outstanding.",
  },
  {
    title: "Solicitors",
    body: "Accept or decline leads, ask the follow-up questions, write the statements, and send them for signature.",
  },
  {
    title: "Admins",
    body: "Turn lead types on and off, build new ones, set the enquiry page and branding, invite the team, and manage the plan. Seats are included.",
  },
] as const;

export default function PlatformPage() {
  return (
    <MarketingPage>
      <MarketingPageHero
        eyebrow="Platform"
        title="From the first enquiry to the signed statement."
        description="One lead, one file. Enquiries, accounts, documents, witnesses, and statements stay together, and everyone on the team works from the same page."
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
        title="Everything about the matter stays on the matter."
        description="Notes, reminders, follow-up requests, signed statements, and the activity trail sit on each lead, so whoever picks it up next can see what happened."
      />

      <MarketingPageSection
        eyebrow="Teams"
        title="Same file. Different jobs."
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
        title="Bring one live enquiry. We will show you the file."
        description="Send us an enquiry the firm received this week. We will run it through Casey and show what the team would have seen."
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
