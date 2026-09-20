import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandMark } from "../components/BrandMark";
import { ProductStage } from "../components/ProductStage";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { sansFont } from "../fonts";

const SOURCE_Y = 70;
const OUTPUT_Y = 570;
const SOURCE_LINE_START = 126;
const HUB_IN = 271.4;
const HUB_OUT = 348.6;
const OUTPUT_LINE_END = 534;
const BRAND = "#7357FF";

const sources = [
  { label: "Videos", color: "#34d399", x: 100 },
  { label: "Files", color: "#38bdf8", x: 300 },
  { label: "Images", color: "#fb7185", x: 500 },
  { label: "Transcript", color: "#f59e0b", x: 700 },
] as const;

const outputs = [
  { label: "Statement", x: 100 },
  { label: "Chronology", x: 300 },
  { label: "Gaps", x: 500 },
  { label: "Evidence", x: 700 },
] as const;

const sourceIcons = {
  Videos: (
    <>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
  Files: (
    <>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  Images: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </>
  ),
  Transcript: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </>
  ),
} as const;

const outputIcons = {
  Statement: (
    <>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M8 12h8M8 16h5" />
    </>
  ),
  Chronology: (
    <>
      <path d="M15 6a9 9 0 0 0-9 9V3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
    </>
  ),
  Gaps: (
    <>
      <path d="M13 5h8M13 12h8M13 19h8" />
      <path d="m3 17 2 2 4-4M3 7l2 2 4-4" />
    </>
  ),
  Evidence: (
    <>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </>
  ),
} as const;

function sourcePath(x: number) {
  return `M ${x} ${SOURCE_LINE_START} C ${x} 198.7, 400 198.7, 400 ${HUB_IN}`;
}

function outputPath(x: number) {
  return `M 400 ${HUB_OUT} C 400 441.3, ${x} 441.3, ${x} ${OUTPUT_LINE_END}`;
}

function cubicPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
) {
  const u = 1 - t;
  return {
    x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
    y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
  };
}

function sourcePoint(x: number, t: number) {
  return cubicPoint(t, x, SOURCE_LINE_START, x, 198.7, 400, 198.7, 400, HUB_IN);
}

function outputPoint(x: number, t: number) {
  return cubicPoint(t, 400, HUB_OUT, 400, 441.3, x, 441.3, x, OUTPUT_LINE_END);
}

export const SourcesMerge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="interview" />
      <ProductStage
        entrance="scale"
        tilt="twist"
        caption="Pull every source into one statement."
        captionEntrance="scale"
      >
          <svg
            viewBox="0 0 800 640"
            width={920}
            height={736}
            role="img"
          >
            <defs>
              <linearGradient id="merge-icon-frame" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient
                id="merge-source-line"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={SOURCE_LINE_START}
                x2="0"
                y2={HUB_IN}
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="100%" stopColor={BRAND} stopOpacity="0.8" />
              </linearGradient>
              <linearGradient
                id="merge-output-line"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={HUB_OUT}
                x2="0"
                y2={OUTPUT_LINE_END}
              >
                <stop offset="0%" stopColor={BRAND} stopOpacity="0.8" />
                <stop offset="100%" stopColor={BRAND} stopOpacity="0.15" />
              </linearGradient>
            </defs>

            {sources.map((source, index) => (
              <g
                key={source.label}
                style={{
                  opacity: interpolate(
                    frame,
                    [0.15 * fps + index * 4, 0.4 * fps + index * 4],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  ),
                }}
              >
                <rect
                  x={source.x - 30}
                  y={SOURCE_Y - 30}
                  width="60"
                  height="60"
                  rx="14"
                  fill="url(#merge-icon-frame)"
                  stroke="#ffffff"
                  strokeOpacity="0.12"
                />
                <circle
                  cx={source.x}
                  cy={SOURCE_Y}
                  r="26"
                  fill={source.color}
                  fillOpacity="0.12"
                />
                <g
                  transform={`translate(${source.x - 18} ${SOURCE_Y - 18}) scale(1.5)`}
                  fill="none"
                  stroke={source.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {sourceIcons[source.label]}
                </g>
                <text
                  x={source.x}
                  y={SOURCE_Y + 52}
                  textAnchor="middle"
                  fill="#f4f5fb"
                  fillOpacity="0.72"
                  fontSize="18"
                  fontFamily={sansFont}
                >
                  {source.label}
                </text>
              </g>
            ))}

            {sources.map((source, index) => (
              <path
                key={`${source.label}-line`}
                d={sourcePath(source.x)}
                fill="none"
                stroke="url(#merge-source-line)"
                strokeWidth="1.8"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={interpolate(
                  frame,
                  [0.35 * fps + index * 5, 1.15 * fps + index * 5],
                  [1, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                  },
                )}
              />
            ))}

            {sources.map((source, index) => {
              const start = 0.85 * fps + index * 5;
              const end = start + 1.7 * fps;
              const t = interpolate(frame, [start, end], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const point = sourcePoint(source.x, t);
              return (
                <circle
                  key={`${source.label}-dot`}
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  fill="#ffffff"
                  style={{
                    opacity: interpolate(
                      frame,
                      [start, start + 4, end - 4, end],
                      [0, 1, 1, 0],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      },
                    ),
                  }}
                />
              );
            })}

            <g
              transform="translate(400 310)"
              style={{
                opacity: interpolate(frame, [1.1 * fps, 1.55 * fps], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <g transform="translate(-42 -42)">
                <BrandMark size={84} gradientId="merge-casey-mark" />
              </g>
            </g>

            {outputs.map((output, index) => (
              <path
                key={`${output.label}-line`}
                d={outputPath(output.x)}
                fill="none"
                stroke="url(#merge-output-line)"
                strokeWidth="1.8"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={interpolate(
                  frame,
                  [1.45 * fps + index * 5, 2.2 * fps + index * 5],
                  [1, 0],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.22, 1, 0.36, 1),
                  },
                )}
              />
            ))}

            {outputs.map((output, index) => {
              const start = 2.05 * fps + index * 5;
              const end = start + 1.7 * fps;
              const t = interpolate(frame, [start, end], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const point = outputPoint(output.x, t);
              return (
                <circle
                  key={`${output.label}-dot`}
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  fill={BRAND}
                  style={{
                    opacity: interpolate(
                      frame,
                      [start, start + 4, end - 4, end],
                      [0, 1, 1, 0],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      },
                    ),
                  }}
                />
              );
            })}

            {outputs.map((output, index) => (
              <g
                key={output.label}
                style={{
                  opacity: interpolate(
                    frame,
                    [1.7 * fps + index * 4, 2.1 * fps + index * 4],
                    [0, 1],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    },
                  ),
                }}
              >
                <rect
                  x={output.x - 30}
                  y={OUTPUT_Y - 30}
                  width="60"
                  height="60"
                  rx="14"
                  fill="url(#merge-icon-frame)"
                  stroke="#ffffff"
                  strokeOpacity="0.12"
                />
                <circle
                  cx={output.x}
                  cy={OUTPUT_Y}
                  r="26"
                  fill={BRAND}
                  fillOpacity="0.12"
                />
                <g
                  transform={`translate(${output.x - 18} ${OUTPUT_Y - 18}) scale(1.5)`}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {outputIcons[output.label]}
                </g>
                <text
                  x={output.x}
                  y={OUTPUT_Y + 52}
                  textAnchor="middle"
                  fill="#f4f5fb"
                  fillOpacity="0.72"
                  fontSize="18"
                  fontFamily={sansFont}
                >
                  {output.label}
                </text>
              </g>
            ))}
          </svg>
      </ProductStage>
    </AbsoluteFill>
  );
};
