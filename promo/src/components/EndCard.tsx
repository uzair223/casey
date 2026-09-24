import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont, sansFont } from "../fonts";
import { brand, ink } from "../theme";
import { BrandMark } from "./BrandMark";

export const EndCard: React.FC<{ line: string }> = ({ line }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Background"
      style={{
        backgroundColor: "#f3efe6",
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
            "radial-gradient(circle, rgba(154, 64, 52, 0.16) 0%, rgba(243, 239, 230, 0) 70%)",
          translate: interpolate(
            frame,
            [0, durationInFrames],
            ["0px 0px", "36px 40px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.22, 1, 0.36, 1),
            },
          ),
          scale: interpolate(frame, [0, durationInFrames], [1, 1.05], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            output: "perceptual-scale",
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
          <BrandMark size={96} color={brand} />
          <Interactive.Div
            name="Tagline"
            style={{
              marginTop: 40,
              maxWidth: 920,
              color: ink,
              fontFamily: displayFont,
              fontSize: 56,
              lineHeight: 1.14,
              textAlign: "center",
            }}
          >
            {line}
          </Interactive.Div>
          <Interactive.Div
            name="URL"
            style={{
              marginTop: 36,
              color: ink,
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
