"use client";

import {
  Check,
  FileText,
  ListChecks,
  Paperclip,
  SendHorizonal,
} from "@/components/icons";

import { MessageCard } from "@/components/ui/message";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const intakeMessages = [
  {
    role: "assistant",
    content:
      "Tell me what happened, in your own words. Where were you just before the incident?",
  },
  {
    role: "user",
    content:
      "I arrived at the site around 08:10. The barrier dropped as I passed and struck my left shoulder.",
  },
  {
    role: "assistant",
    content:
      "Thank you. Do you have photos, treatment records, or anyone who saw the barrier fall?",
  },
] as const;

const draftSections = [
  {
    heading: "1. Introduction",
    body: "I am the Claimant in these proceedings. This statement is true to the best of my knowledge and belief.",
  },
  {
    heading: "2. The incident",
    body: "On the morning of the incident I arrived at the site at approximately 08:10. As I passed the barrier, it dropped without warning and struck my left shoulder.",
  },
  {
    heading: "3. Immediate aftermath",
    body: "I stopped work, reported the incident, and later attended for treatment. Photographs of the barrier and my injuries are attached as exhibits.",
  },
] as const;

const chronology = [
  {
    time: "08:10",
    event: "Arrives on site",
    source: "J. Doe",
  },
  {
    time: "08:12",
    event: "Barrier drops and strikes left shoulder",
    source: "J. Doe",
  },
  {
    time: "08:20",
    event: "Incident reported to site supervisor",
    source: "J. Doe",
  },
] as const;

function ProductFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/15 bg-card/40 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
      <div className="pointer-events-none relative h-[32rem] overflow-hidden sm:h-[36rem]">
        {children}
      </div>
    </div>
  );
}

function StageTabs({
  items,
  active,
}: {
  items: string[];
  active: string;
}) {
  return (
    <div className="flex gap-4 border-b border-primary/10 px-4">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "border-b-2 py-2.5 text-sm",
            item === active
              ? "border-primary text-primary"
              : "border-transparent text-primary/45",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function WitnessRail({
  active = "Jane Doe",
  status = "Collecting",
}: {
  active?: string;
  status?: string;
}) {
  const witnesses = [
    { name: "Jane Doe", status, email: "jane@example.com" },
    { name: "James Cole", status: "Collecting", email: "j.cole@example.com" },
    { name: "Site supervisor", status: "Draft", email: "—" },
  ];

  return (
    <div className="hidden h-full w-[220px] shrink-0 border-r border-primary/10 bg-[#101010] p-3 sm:block">
      <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.16em] text-primary/40">
        People
      </p>
      <div className="space-y-1">
        {witnesses.map((witness) => (
          <div
            key={witness.name}
            className={cn(
              "rounded-lg px-2.5 py-2",
              witness.name === active ? "bg-primary/10" : "opacity-70",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-primary">{witness.name}</p>
              <span className="rounded-full border border-primary/15 px-1.5 py-0.5 text-[10px] text-primary/70">
                {witness.status}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-primary/40">
              {witness.email}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntakeMock() {
  return (
    <div className="flex h-full flex-col bg-background px-4 pt-4 sm:px-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-brand">
        Northbridge Law enquiry
      </p>
      <h3 className="mt-1 font-display text-xl text-primary">
        Workplace accident — 14 March 2026
      </h3>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/10 bg-card/50">
        <StageTabs
          items={["Chat", "Evidence Confirmation", "Statement Preview"]}
          active="Chat"
        />
        <div className="flex-1 space-y-3 overflow-hidden p-4">
          {intakeMessages.map((message, index) => (
            <MessageCard
              key={index}
              message={{ role: message.role, content: message.content }}
            />
          ))}
          {intakeMessages[2] ? (
            <div className="flex gap-1.5 pl-1 text-[11px] text-primary/45">
              <span className="text-brand">✓</span> Background
              <span>○</span> Events
              <span>2/5</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-end gap-2 border-t border-primary/10 p-3">
          <div className="flex h-10 flex-1 items-center rounded-lg border border-primary/10 bg-background px-3 text-sm text-primary/35">
            Type your response, attach files, or both...
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 text-primary/50">
            <Paperclip className="h-4 w-4" />
          </div>
          <div className="flex h-10 items-center rounded-lg bg-brand-fill px-3 text-sm font-medium text-brand-foreground">
            Send
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftMock() {
  return (
    <div className="flex h-full bg-background">
      <WitnessRail status="Review" />
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-primary/45">Account ready</p>
            <h3 className="font-display text-xl text-primary">
              Check your account
            </h3>
          </div>
          <span className="hidden rounded-full bg-brand-fill px-3 py-1.5 text-xs font-medium text-brand-foreground sm:inline-flex">
            Send your account
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-primary/10 bg-white p-6 text-black shadow-inner sm:p-8">
          <p className="text-center text-[11px] tracking-[0.22em] text-neutral-500">
            WITNESS STATEMENT
          </p>
          <p className="mt-4 text-center font-serif text-lg">Jane Doe</p>
          <p className="mt-1 text-center text-xs text-neutral-500">
            Workplace accident — 14 March 2026
          </p>
          <div className="mt-6 space-y-4 text-[13px] leading-6 text-neutral-800">
            {draftSections.map((section) => (
              <div key={section.heading}>
                <p className="font-semibold">{section.heading}</p>
                <p className="mt-1">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisMock() {
  return (
    <div className="flex h-full flex-col bg-background p-4 sm:p-5">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/10 bg-card/50">
        <div className="flex items-center justify-between gap-3 border-b border-primary/10 px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <ListChecks className="h-4 w-4" />
              Facts & gaps
            </p>
            <p className="mt-0.5 text-[11px] text-primary/45">
              Generated from 2 statements
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/15 px-2.5 py-1 text-xs text-primary/80">
            Regenerate
          </span>
        </div>
        <StageTabs
          items={["Summary", "Chronology", "Facts", "Gaps", "Evidence"]}
          active="Chronology"
        />
        <div className="grid gap-2 border-b border-primary/10 p-4 sm:grid-cols-4">
          {[
            ["4", "Shared facts"],
            ["1", "Conflicts"],
            ["3", "Open gaps"],
            ["2", "Evidence"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-md border border-primary/10 px-3 py-2">
              <p className="text-lg font-semibold text-primary">{value}</p>
              <p className="text-[11px] text-primary/45">{label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-0 overflow-hidden">
          {chronology.map((item) => (
            <div
              key={item.time}
              className="grid gap-2 border-b border-primary/10 px-4 py-3 sm:grid-cols-[6rem_1fr]"
            >
              <div className="flex items-start gap-2 text-sm text-primary">
                <span className="mt-1.5 size-2 rounded-full bg-primary/60" />
                {item.time}
              </div>
              <div>
                <p className="text-sm text-primary">{item.event}</p>
                <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary/70">
                  {item.source}
                </span>
              </div>
            </div>
          ))}
          <div className="grid gap-2 px-4 py-3 sm:grid-cols-[6rem_1fr]">
            <div className="flex items-start gap-2 text-sm text-primary/50">
              <span className="mt-1.5 size-2 rounded-full bg-amber-400/80" />
              Undated
            </div>
            <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
              <p className="text-sm text-primary">
                Name of the supervisor who took the report is missing
              </p>
              <p className="mt-1 text-[11px] text-primary/50">
                Follow up before review
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignatureMock() {
  return (
    <div className="flex h-full flex-col bg-background p-4 sm:p-5">
      <p className="text-xs text-primary/45">Final signature required</p>
      <h3 className="mt-1 font-display text-xl text-primary">
        Review and sign your statement
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-primary/65">
        Jane Doe, please review the finalized statement for Workplace accident —
        14 March 2026.
      </p>
      <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-primary/80">
        <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded border border-brand-fill bg-brand-fill text-[10px] text-brand-foreground">
          ✓
        </span>
        I intend to sign this statement as Jane Doe and confirm that the account
        is true to the best of my knowledge.
      </div>
      <div className="mt-4 max-w-md rounded-xl border border-primary/15 bg-white px-4 py-3 text-black">
        <svg viewBox="0 0 360 72" className="h-16 w-full" aria-hidden>
          <path
            d="M16 46 C 48 18, 62 62, 92 34 S 140 14, 168 42 S 214 60, 248 28 S 300 12, 340 38"
            fill="none"
            stroke="#12110f"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-[11px] text-neutral-500">Jane Doe · 14 March 2026</p>
      </div>
      <span className="mt-4 inline-flex w-fit rounded-full bg-brand-fill px-4 py-2 text-sm font-medium text-brand-foreground">
        Submit final signed statement
      </span>
    </div>
  );
}

function ReviewMock() {
  return (
    <div className="flex h-full bg-background">
      <WitnessRail status="Review" />
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-primary/45">Jane Doe · Details</p>
            <h3 className="font-display text-xl text-primary">
              Ready for solicitor review
            </h3>
          </div>
          <span className="hidden items-center gap-1 rounded-md border border-primary/15 px-2.5 py-1.5 text-xs text-primary sm:inline-flex">
            <SendHorizonal className="h-3.5 w-3.5" />
            Finalize and request signature
          </span>
        </div>
        <StageTabs
          items={["Details", "Documents", "Follow-up", "Issues"]}
          active="Details"
        />
        <div className="mt-4 grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[1fr_220px]">
          <div className="space-y-3 overflow-hidden">
            {draftSections.map((section) => (
              <div
                key={section.heading}
                className="rounded-xl border border-primary/10 bg-card/40 p-3"
              >
                <p className="text-sm font-medium text-primary">
                  {section.heading}
                </p>
                <p className="mt-1.5 rounded-md border border-primary/10 bg-muted/20 px-3 py-2 text-sm leading-6 text-primary/75">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden space-y-3 lg:block">
            <div className="rounded-xl border border-primary/10 bg-card/40 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-primary/40">
                Actions
              </p>
              <p className="mt-2 text-sm text-primary">Chronology holds</p>
              <p className="mt-1 text-xs leading-5 text-primary/50">
                Ask for the treatment record and supervisor name before this
                goes out for signature.
              </p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-card/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-primary/40">
                <FileText className="h-3 w-3" />
                Evidence
              </p>
              {["Barrier photo.jpg", "Incident report.pdf"].map((file) => (
                <div
                  key={file}
                  className="mt-1.5 flex items-center gap-2 rounded-md border border-primary/10 px-2 py-1.5 text-xs text-primary/80"
                >
                  <Check className="h-3 w-3 text-brand" />
                  {file}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const tabs = [
  {
    value: "intake",
    label: "Intake",
    overlayTitle: "Interview in progress",
    overlayMeta: "Next useful question queued",
    mock: <IntakeMock />,
  },
  {
    value: "draft",
    label: "Account",
    overlayTitle: "Account sent",
    overlayMeta: "Ready for the firm to review",
    mock: <DraftMock />,
  },
  {
    value: "analysis",
    label: "Analysis",
    overlayTitle: "Gaps surfaced",
    overlayMeta: "3 items still missing",
    mock: <AnalysisMock />,
  },
  {
    value: "review",
    label: "Review",
    overlayTitle: "Ready for review",
    overlayMeta: "Accounts and documents attached",
    mock: <ReviewMock />,
  },
  {
    value: "signature",
    label: "Signature",
    overlayTitle: "Review and sign",
    overlayMeta: "Final signature required",
    mock: <SignatureMock />,
  },
] as const;

export function ProductPreview() {
  return (
    <Tabs defaultValue="intake" className="space-y-4">
      <TabsList className="sticky top-[calc(var(--header-height)+0.75rem)] z-20 mx-auto flex h-auto w-fit justify-center gap-1 overflow-visible rounded-full border border-primary/10 bg-[#141414]/90 p-1 backdrop-blur-md">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="rounded-full border-0 px-4 py-2 text-sm font-normal text-primary/60 hover:text-primary data-[state=active]:border-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="relative">
          <ProductFrame>{tab.mock}</ProductFrame>
          <div className="absolute bottom-6 left-6 rounded-lg border border-primary/10 bg-black/80 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-primary">{tab.overlayTitle}</p>
            <p className="mt-0.5 text-[11px] text-primary/50">{tab.overlayMeta}</p>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
