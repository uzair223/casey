"use client";

import { useId } from "react";

import { BrandMarkGlyph } from "@/components/brand-mark";
import { MessageCard } from "@/components/ui/message";

const intakeMessages = [
  {
    role: "assistant",
    content:
      "Where were you immediately before the incident, in your own words?",
  },
  {
    role: "user",
    content:
      "I arrived at the site around 08:10. The barrier dropped as I passed and struck my left shoulder.",
  },
] as const;

export function AboutInterviewVisual() {
  return (
    <div className="rounded-2xl border border-primary/15 bg-card/40 p-5 sm:p-7">
      <p className="font-display text-lg italic text-brand">Witness intake</p>
      <p className="mt-1 font-display text-2xl text-primary">
        Workplace accident — 14 March 2026
      </p>
      <div className="mt-6 space-y-3">
        {intakeMessages.map((message, index) => (
          <MessageCard
            key={index}
            message={{ role: message.role, content: message.content }}
          />
        ))}
      </div>
    </div>
  );
}

type Glyph = {
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  w?: number;
  h?: number;
  x?: number;
  y?: number;
  rx?: number;
};

const icons = {
  videos: [
    {
      d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",
    },
    { x: 2, y: 6, w: 14, h: 12, rx: 2 },
  ],
  files: [
    { d: "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" },
    { d: "M14 3v5h5" },
  ],
  images: [
    { x: 3, y: 3, w: 18, h: 18, rx: 2 },
    { cx: 9, cy: 9, r: 2 },
    { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" },
  ],
  transcript: [
    { x: 3, y: 5, w: 18, h: 14, rx: 2 },
    { d: "M7 15h4M15 15h2M7 11h2M13 11h4" },
  ],
  statement: [
    { d: "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" },
    { d: "M14 3v5h5" },
    { d: "M8 12h8M8 16h5" },
  ],
  chronology: [
    { d: "M15 6a9 9 0 0 0-9 9V3" },
    { cx: 18, cy: 6, r: 3 },
    { cx: 6, cy: 18, r: 3 },
  ],
  gaps: [
    { d: "M13 5h8M13 12h8M13 19h8" },
    { d: "m3 17 2 2 4-4M3 7l2 2 4-4" },
  ],
  evidence: [
    { d: "m21 21-4.34-4.34" },
    { cx: 11, cy: 11, r: 8 },
  ],
} satisfies Record<string, Glyph[]>;

type IconName = keyof typeof icons;

function spacedX(index: number, count: number) {
  return (800 / count) * (index + 0.5);
}

const PAPER = "#f3efe6";
const WAX = "#9a4034";

const sources: { label: string; color: string; x: number; icon: IconName }[] =
  (
    [
      { label: "Videos", color: "#34d399", icon: "videos" },
      { label: "Files", color: "#38bdf8", icon: "files" },
      { label: "Images", color: "#fb7185", icon: "images" },
      { label: "Transcript", color: "#f59e0b", icon: "transcript" },
    ] as const
  ).map((source, index, list) => ({
    ...source,
    x: spacedX(index, list.length),
  }));

const outputs: { label: string; x: number; icon: IconName }[] = (
  [
    { label: "Statement", icon: "statement" },
    { label: "Chronology", icon: "chronology" },
    { label: "Gaps", icon: "gaps" },
    { label: "Evidence", icon: "evidence" },
  ] as const
).map((output, index, list) => ({
  ...output,
  x: spacedX(index, list.length),
}));

const SOURCE_Y = 70;
const OUTPUT_Y = 570;
const SOURCE_LINE_START = 126;
const HUB_IN = 271.4;
const HUB_OUT = 348.6;
const OUTPUT_LINE_END = 534;

function sourcePath(x: number) {
  return `M ${x} ${SOURCE_LINE_START} C ${x} 198.7, 400 198.7, 400 ${HUB_IN}`;
}

function outputPath(x: number) {
  return `M 400 ${HUB_OUT} C 400 441.3, ${x} 441.3, ${x} ${OUTPUT_LINE_END}`;
}

function NodeGlyph({ icon, color }: { icon: IconName; color: string }) {
  return (
    <>
      {(icons[icon] as Glyph[]).map((shape, index) =>
        shape.d ? (
          <path key={index} d={shape.d} stroke={color} fill="none" />
        ) : shape.r !== undefined ? (
          <circle
            key={index}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            stroke={color}
            fill="none"
          />
        ) : (
          <rect
            key={index}
            x={shape.x}
            y={shape.y}
            width={shape.w}
            height={shape.h}
            rx={shape.rx}
            stroke={color}
            fill="none"
          />
        ),
      )}
    </>
  );
}

function FlowNode({
  x,
  y,
  color,
  label,
  icon,
  frameId,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  icon: IconName;
  frameId: string;
}) {
  return (
    <g>
      <rect
        x={x - 30}
        y={y - 30}
        width="60"
        height="60"
        rx="14"
        fill={`url(#${frameId})`}
        stroke={PAPER}
        strokeOpacity="0.14"
        strokeWidth="1"
      />
      <circle cx={x} cy={y} r="26" fill={color} fillOpacity="0.16" />
      <g
        transform={`translate(${x - 18} ${y - 18}) scale(1.5)`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <NodeGlyph icon={icon} color={color} />
      </g>
      <text
        x={x}
        y={y + 48}
        textAnchor="middle"
        fill={PAPER}
        fillOpacity="0.72"
        fontSize="12"
        letterSpacing="0.05em"
        fontFamily="Source Sans 3, ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

export function SourcesMergeAnimation() {
  const rawId = useId().replace(/:/g, "");
  const sourceLine = `${rawId}-source-line`;
  const outputLine = `${rawId}-output-line`;
  const iconFrame = `${rawId}-icon-frame`;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <svg viewBox="0 0 800 640" className="h-auto w-full" role="img">
        <title>Witness information sources flowing into Casey outputs</title>
        <defs>
          <linearGradient id={iconFrame} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={PAPER} stopOpacity="0.08" />
            <stop offset="100%" stopColor={PAPER} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient
            id={sourceLine}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={SOURCE_LINE_START}
            x2="0"
            y2={HUB_IN}
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor={WAX} stopOpacity="0.8" />
          </linearGradient>
          <linearGradient
            id={outputLine}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={HUB_OUT}
            x2="0"
            y2={OUTPUT_LINE_END}
          >
            <stop offset="0%" stopColor={WAX} stopOpacity="0.8" />
            <stop offset="100%" stopColor={WAX} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {sources.map((source) => (
          <FlowNode
            key={source.label}
            x={source.x}
            y={SOURCE_Y}
            color={source.color}
            label={source.label}
            icon={source.icon}
            frameId={iconFrame}
          />
        ))}

        {sources.map((source) => (
          <path
            key={`${source.label}-line`}
            d={sourcePath(source.x)}
            fill="none"
            stroke={`url(#${sourceLine})`}
            strokeWidth="1.25"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1 1"
          />
        ))}

        {sources.map((source, index) => (
          <circle
            key={`${source.label}-dot`}
            className="sources-merge-dot"
            r="2.5"
            fill="#ffffff"
          >
            <animateMotion
              dur={`${2.4 + index * 0.3}s`}
              begin={`${1.5 + index * 0.12}s`}
              repeatCount="indefinite"
              path={sourcePath(source.x)}
            />
          </circle>
        ))}

        <g
          color={PAPER}
          transform="translate(400 310) scale(0.11) translate(-256 -256)"
        >
          <BrandMarkGlyph />
        </g>

        {outputs.map((output) => (
          <path
            key={`${output.label}-line`}
            d={outputPath(output.x)}
            fill="none"
            stroke={`url(#${outputLine})`}
            strokeWidth="1.25"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1 1"
          />
        ))}

        {outputs.map((output, index) => (
          <circle
            key={`${output.label}-dot`}
            className="sources-merge-dot"
            r="2.5"
            fill={WAX}
          >
            <animateMotion
              dur={`${2.4 + index * 0.3}s`}
              begin={`${2.2 + index * 0.12}s`}
              repeatCount="indefinite"
              path={outputPath(output.x)}
            />
          </circle>
        ))}

        {outputs.map((output) => (
          <FlowNode
            key={output.label}
            x={output.x}
            y={OUTPUT_Y}
            color={WAX}
            label={output.label}
            icon={output.icon}
            frameId={iconFrame}
          />
        ))}
      </svg>
    </div>
  );
}
