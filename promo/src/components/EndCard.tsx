import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, sansFont } from "../fonts";
import { BrandMark } from "./BrandMark";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Background"
      style={{
        backgroundColor: "#f4f5fb",
        overflow: "hidden",
      }}
    >
      <Interactive.Div
        name="Wash"
        style={{
          position: "absolute",
          left: -80,
          top: 140,
          width: 980,
          height: 980,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(115, 87, 255, 0.14) 0%, rgba(244, 245, 251, 0) 70%)",
          translate: interpolate(frame, [0, durationInFrames], ["0px 0px", "36px 40px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
          scale: interpolate(frame, [0, durationInFrames], [1, 1.05], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            output: "perceptual-scale",
          }),
        }}
      />
      <Interactive.Div
        name="Wash 2"
        style={{
          position: "absolute",
          left: 180,
          top: 860,
          width: 820,
          height: 820,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(45, 53, 232, 0.12) 0%, rgba(244, 245, 251, 0) 70%)",
          translate: interpolate(frame, [0, durationInFrames], ["0px 12px", "-28px -36px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 80,
          paddingRight: 80,
          perspective: "1600px",
        }}
      >
        <Interactive.Div
          name="Lockup"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: interpolate(frame, [0, 0.45 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <Interactive.Div name="Mark">
            <BrandMark size={96} gradientId="end-mark" />
          </Interactive.Div>
          <Interactive.Div
            name="Tagline"
            style={{
              marginTop: 40,
              maxWidth: 920,
              color: "#101010",
              fontFamily: displayFont,
              fontSize: 56,
              lineHeight: 1.14,
              textAlign: "center",
            }}
          >
            Your solicitors deserve their best thinking, not more chasing.
          </Interactive.Div>
          <Interactive.Div
            name="URL"
            style={{
              marginTop: 36,
              color: "#101010",
              fontFamily: sansFont,
              fontSize: 34,
            }}
          >
            caseyhq.co.uk
          </Interactive.Div>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
