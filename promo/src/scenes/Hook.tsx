import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandMark } from "../components/BrandMark";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { displayFont } from "../fonts";
import { cream } from "../theme";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const reveal = [0, 0.4 * fps] as const;

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="logo" />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 80,
          paddingRight: 80,
        }}
      >
        <Interactive.Div
          name="Lockup"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: interpolate(frame, reveal, [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            scale: interpolate(frame, [0, 0.45 * fps, durationInFrames], [0.96, 1, 1.03], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [
                Easing.spring({ damping: 200 }),
                Easing.bezier(0.22, 1, 0.36, 1),
              ],
              output: "perceptual-scale",
            }),
          }}
        >
          <BrandMark size={88} color={cream} />
          <div
            style={{
              marginTop: 36,
              maxWidth: 920,
              color: cream,
              fontFamily: displayFont,
              fontSize: 92,
              lineHeight: 1.05,
              textAlign: "center",
            }}
          >
            Leads worth opening.
          </div>
          <svg viewBox="0 0 220 16" width={220} height={16} style={{ marginTop: 18 }}>
            <Interactive.Path
              name="Underline"
              d="M2 10 C 40 4, 70 14, 110 8 S 180 12, 218 6"
              fill="none"
              stroke="#9a4034"
              strokeWidth={3}
              strokeLinecap="round"
              style={{
                strokeDasharray: 240,
                strokeDashoffset: interpolate(frame, [0.35 * fps, 0.9 * fps], [240, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
              }}
            />
          </svg>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
