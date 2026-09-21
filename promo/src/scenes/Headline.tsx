import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { displayFont } from "../fonts";

export const Headline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="interview" />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 80,
          paddingRight: 80,
          perspective: 1400,
        }}
      >
        <Interactive.Div
          name="Headline"
          style={{
            color: "#f4f5fb",
            fontFamily: displayFont,
            fontSize: 88,
            lineHeight: 1.06,
            textAlign: "center",
            letterSpacing: -1.5,
            opacity: interpolate(frame, [0, 0.45 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            scale: interpolate(
              frame,
              [0, 0.45 * fps, durationInFrames],
              [0.97, 1, 1.04],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: [
                  Easing.spring({ damping: 200 }),
                  Easing.bezier(0.22, 1, 0.36, 1),
                ],
                output: "perceptual-scale",
              },
            ),
          }}
        >
          <div
            style={{
              transformOrigin: "50% 50%",
              transform: `perspective(1400px) rotateX(${interpolate(
                frame,
                [0, 0.6 * fps, durationInFrames],
                [-3, 0.8, 0.3],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                },
              )}deg) rotateY(${interpolate(
                frame,
                [0, durationInFrames],
                [6, -1.5],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.22, 1, 0.36, 1),
                },
              )}deg)`,
            }}
          >
            Let the evidence write
            <br />
            the first draft.
          </div>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
