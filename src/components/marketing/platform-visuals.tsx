import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function VisualStage({
  children,
  glow = "18% 0%",
  className,
  name,
}: {
  children: ReactNode;
  glow?: string;
  className?: string;
  name: string;
}) {
  return (
    <div
      data-platform-visual={name}
      className={cn(
        "relative flex min-h-[10.5rem] flex-1 overflow-hidden px-5 py-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${glow}, color-mix(in oklab, var(--brand) 20%, transparent), transparent 58%)`,
        }}
      />
      <div className="relative flex w-full items-center">{children}</div>
    </div>
  );
}

export function IntakeVisual() {
  return (
    <VisualStage
      name="intake"
      className="min-h-[12.5rem] items-end pb-5 pt-8"
    >
      <div className="w-full space-y-2.5">
        <div
          className="platform-visual-item flex h-9 w-[72%] items-center gap-2.5 rounded-full border border-primary/10 bg-background/50 px-3"
          style={{ animationDelay: "80ms" }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
          <span className="h-1.5 flex-1 rounded-full bg-primary/20" />
          <span className="h-1.5 w-8 rounded-full bg-primary/10" />
        </div>
        <div
          className="platform-visual-item ml-auto w-[78%] rounded-2xl rounded-br-md border border-primary/10 bg-primary/[0.07] p-3"
          style={{ animationDelay: "220ms" }}
        >
          <div className="space-y-1.5">
            <span className="block h-1.5 w-[92%] rounded-full bg-primary/30" />
            <span className="block h-1.5 w-[64%] rounded-full bg-primary/15" />
          </div>
        </div>
        <div
          className="platform-visual-item w-[70%] rounded-2xl rounded-bl-md border border-brand/20 bg-brand/10 p-3"
          style={{ animationDelay: "380ms" }}
        >
          <div className="space-y-1.5">
            <span className="block h-1.5 w-[80%] rounded-full bg-brand/50" />
            <span className="block h-1.5 w-[46%] rounded-full bg-brand/25" />
          </div>
        </div>
        <div
          className="platform-visual-item flex w-[42%] items-center gap-1.5 rounded-full border border-primary/10 px-3 py-2"
          style={{ animationDelay: "520ms" }}
        >
          <span className="platform-visual-dot h-1.5 w-1.5 rounded-full bg-brand" />
          <span
            className="platform-visual-dot h-1.5 w-1.5 rounded-full bg-brand"
            style={{ animationDelay: "180ms" }}
          />
          <span
            className="platform-visual-dot h-1.5 w-1.5 rounded-full bg-brand"
            style={{ animationDelay: "360ms" }}
          />
        </div>
      </div>
    </VisualStage>
  );
}

export function CaptureVisual() {
  const rows = [
    { width: "88%", delay: "0ms" },
    { width: "62%", delay: "1.2s" },
    { width: "74%", delay: "2.4s" },
  ] as const;

  return (
    <VisualStage name="capture" glow="80% 10%">
      <div className="w-full space-y-2">
        {rows.map((row) => (
          <div
            key={row.delay}
            className="platform-visual-active flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
            style={{ animationDelay: row.delay }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary/25" />
            <span
              className="h-1.5 rounded-full bg-primary/25"
              style={{ width: row.width }}
            />
          </div>
        ))}
      </div>
    </VisualStage>
  );
}

export function DraftingVisual() {
  const lines = ["92%", "76%", "58%", "84%", "40%"] as const;

  return (
    <VisualStage name="drafting" glow="12% 80%">
      <div className="relative w-full overflow-hidden rounded-xl border border-primary/10 bg-background/40 px-4 py-4">
        <div
          className="platform-visual-item mb-3 flex items-center gap-2"
          style={{ animationDelay: "80ms" }}
        >
          <span className="h-1.5 w-16 rounded-full bg-brand/70" />
          <span className="platform-visual-cursor h-3.5 w-px bg-brand" />
        </div>
        <div className="space-y-2">
          {lines.map((width, index) => (
            <span
              key={width}
              className="platform-visual-item block h-1.5 rounded-full bg-primary/20"
              style={{ width, animationDelay: `${140 + index * 80}ms` }}
            />
          ))}
        </div>
        <div
          aria-hidden
          className="platform-visual-scan pointer-events-none absolute inset-x-3 top-7 h-6 rounded-md bg-brand/15"
        />
      </div>
    </VisualStage>
  );
}

export function TimelineVisual() {
  const nodes = [
    { x: 56, label: "08:10" },
    { x: 176, label: "Incident" },
    { x: 296, label: "Report" },
    { x: 416, label: "Gap" },
  ] as const;

  return (
    <VisualStage name="timeline" glow="80% 20%" className="min-h-[12.5rem] px-4">
      <svg
        viewBox="0 0 480 160"
        className="h-auto w-full"
        role="img"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="platform-timeline-stroke"
            x1="56"
            y1="72"
            x2="416"
            y2="72"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.15" />
            <stop offset="55%" stopColor="var(--brand)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          className="platform-visual-line"
          d="M 56 72 H 416"
          fill="none"
          stroke="url(#platform-timeline-stroke)"
          strokeWidth="1.5"
          pathLength="1"
        />
        {nodes.map((node, index) => {
          const gap = index === nodes.length - 1;
          return (
            <g key={node.label}>
              <circle
                className="platform-visual-node"
                cx={node.x}
                cy="72"
                r="9"
                fill={gap ? "transparent" : "var(--brand)"}
                stroke="var(--brand)"
                strokeWidth={gap ? 1.5 : 0}
                strokeDasharray={gap ? "3 3" : undefined}
                style={{ animationDelay: `${180 + index * 160}ms` }}
              />
              {!gap ? (
                <circle
                  cx={node.x}
                  cy="72"
                  r="3"
                  fill="#f4f5fb"
                  className="platform-visual-node"
                  style={{ animationDelay: `${240 + index * 160}ms` }}
                />
              ) : null}
              <text
                x={node.x}
                y="108"
                textAnchor="middle"
                fill="#f4f5fb"
                fillOpacity="0.45"
                fontSize="11"
                letterSpacing="0.08em"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                className="platform-visual-item"
                style={{ animationDelay: `${280 + index * 160}ms` }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
        <circle r="2.5" fill="var(--brand)" className="platform-visual-traveler">
          <animateMotion
            dur="2.8s"
            repeatCount="indefinite"
            path="M 56 72 H 416"
          />
        </circle>
      </svg>
    </VisualStage>
  );
}

export function TemplatesVisual() {
  const tokens = [
    { width: "68%", delay: "0ms" },
    { width: "46%", delay: "180ms" },
    { width: "58%", delay: "360ms" },
  ] as const;

  return (
    <VisualStage name="templates" glow="70% 90%">
      <div className="relative mx-auto h-[9.5rem] w-full max-w-[20rem]">
        <div
          className="platform-visual-item absolute left-0 top-5 h-[8rem] w-[74%]"
          style={{ animationDelay: "80ms" }}
        >
          <div className="h-full w-full origin-bottom-left rotate-[-7deg] rounded-xl border border-primary/15 bg-primary/[0.05]" />
        </div>
        <div
          className="platform-visual-item absolute right-0 top-0 flex h-[8.5rem] w-[78%] flex-col justify-center gap-2.5 rounded-xl border border-brand/40 bg-background/80 px-5"
          style={{ animationDelay: "200ms" }}
        >
          {tokens.map((token) => (
            <span
              key={token.delay}
              className="platform-visual-token flex h-6 items-center gap-1.5 rounded-md border border-brand/35 bg-brand/15 px-2"
              style={{ width: token.width, animationDelay: token.delay }}
            >
              <span className="h-2 w-2 shrink-0 rounded-[3px] bg-brand/70" />
              <span className="h-1.5 flex-1 rounded-full bg-brand/45" />
            </span>
          ))}
        </div>
      </div>
    </VisualStage>
  );
}

export function TeamVisual() {
  const people = ["0ms", "120ms", "240ms", "360ms"] as const;

  return (
    <VisualStage name="team" glow="50% 0%" className="min-h-[8.5rem]">
      <div className="flex w-full flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center">
          {people.map((delay, index) => (
            <span
              key={delay}
              className="platform-visual-item relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 bg-background"
              style={{
                animationDelay: delay,
                marginLeft: index === 0 ? 0 : -10,
                zIndex: people.length - index,
              }}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  index === 0 ? "bg-brand" : "bg-primary/25",
                )}
              />
            </span>
          ))}
        </div>
        <div
          className="platform-visual-item hidden h-8 w-px bg-primary/10 sm:block"
          style={{ animationDelay: "280ms" }}
        />
        <div
          className="platform-visual-item flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-2"
          style={{ animationDelay: "340ms" }}
        >
          <span className="text-[11px] tracking-wide text-brand">@</span>
          <span className="h-1.5 w-16 rounded-full bg-brand/50" />
        </div>
        <div
          className="platform-visual-item flex min-w-[10rem] flex-1 items-center gap-2 rounded-xl border border-primary/10 px-3 py-2"
          style={{ animationDelay: "460ms" }}
        >
          <span className="platform-visual-dot h-1.5 w-1.5 rounded-full bg-brand" />
          <span className="h-1.5 w-[40%] rounded-full bg-primary/25" />
          <span className="h-1.5 w-[22%] rounded-full bg-primary/12" />
        </div>
      </div>
    </VisualStage>
  );
}

export const platformVisuals = {
  intake: IntakeVisual,
  capture: CaptureVisual,
  drafting: DraftingVisual,
  timeline: TimelineVisual,
  templates: TemplatesVisual,
  team: TeamVisual,
} as const;

export type PlatformVisualKind = keyof typeof platformVisuals;
