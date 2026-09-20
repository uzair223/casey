import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { displayFont, sansFont } from "../fonts";

const C_PATH =
  "M379 162C342 112 286 91 221 96C132 103 72 162 72 254C72 344 133 402 225 409C295 414 350 389 384 334";
const TAIL_PATH = "M103 331L76 428L176 397L141 363L103 331Z";

export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="logo" />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 36,
          perspective: 1400,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Interactive.Div
            name="Mark"
            style={{
              width: 152,
              height: 152,
              scale: interpolate(frame, [0, 0.65 * fps], [0.88, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 200 }),
                output: "perceptual-scale",
              }),
              opacity: interpolate(frame, [0, 0.22 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            <div
              style={{
                transformOrigin: "50% 55%",
                transform: `perspective(1400px) rotateY(${interpolate(
                  frame,
                  [0, 0.9 * fps],
                  [12, -2],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.spring({ damping: 170 }),
                  },
                )}deg) rotateX(${interpolate(
                  frame,
                  [0, 0.9 * fps],
                  [-4, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.spring({ damping: 170 }),
                  },
                )}deg)`,
              }}
            >
              <svg
                viewBox="40 64 380 380"
                width={152}
                height={152}
                aria-hidden
                style={{ display: "block" }}
              >
                <defs>
                  <linearGradient
                    id="logo-mark"
                    x1="88"
                    y1="398"
                    x2="420"
                    y2="116"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0" stopColor="#7357FF" />
                    <stop offset="0.55" stopColor="#4E4BFF" />
                    <stop offset="1" stopColor="#2D35E8" />
                  </linearGradient>
                </defs>
                <Interactive.Path
                  name="C stroke"
                  d={C_PATH}
                  fill="none"
                  stroke="url(#logo-mark)"
                  strokeWidth={58}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 1100,
                    strokeDashoffset: interpolate(
                      frame,
                      [0, 0.65 * fps],
                      [1100, 0],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.bezier(0.16, 1, 0.3, 1),
                      },
                    ),
                  }}
                />
                <Interactive.Path
                  name="Tail"
                  d={TAIL_PATH}
                  fill="url(#logo-mark)"
                  style={{
                    opacity: interpolate(frame, [0.35 * fps, 0.6 * fps], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                />
                <Interactive.Path
                  name="Line 1"
                  d="M174 211H254"
                  stroke="#07122E"
                  strokeWidth={25}
                  strokeLinecap="round"
                  style={{
                    opacity: interpolate(frame, [0.45 * fps, 0.68 * fps], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                />
                <Interactive.Path
                  name="Line 2"
                  d="M174 258H309"
                  stroke="#07122E"
                  strokeWidth={25}
                  strokeLinecap="round"
                  style={{
                    opacity: interpolate(frame, [0.52 * fps, 0.75 * fps], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                />
                <Interactive.Path
                  name="Line 3"
                  d="M174 305H252"
                  stroke="#07122E"
                  strokeWidth={25}
                  strokeLinecap="round"
                  style={{
                    opacity: interpolate(frame, [0.58 * fps, 0.82 * fps], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                />
              </svg>
            </div>
          </Interactive.Div>
          <Interactive.Div
            name="Wordmark"
            style={{
              marginTop: 20,
              color: "#f4f5fb",
              fontFamily: displayFont,
              fontSize: 72,
              lineHeight: 1,
              letterSpacing: -1.2,
              opacity: interpolate(frame, [0.55 * fps, 0.95 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(
                frame,
                [0.55 * fps, 0.95 * fps],
                ["0px 10px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.spring({ damping: 200 }),
                },
              ),
            }}
          >
            Casey
          </Interactive.Div>
          <Interactive.Div
            name="Slogan"
            style={{
              marginTop: 12,
              maxWidth: 720,
              color: "rgba(244, 245, 251, 0.7)",
              fontFamily: sansFont,
              fontSize: 32,
              lineHeight: 1.25,
              letterSpacing: 0.1,
              textAlign: "center",
              opacity: interpolate(frame, [0.85 * fps, 1.25 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(
                frame,
                [0.85 * fps, 1.25 * fps],
                ["0px 8px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.spring({ damping: 200 }),
                },
              ),
            }}
          >
            Witness statements without the chasing.
          </Interactive.Div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
