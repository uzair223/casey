import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { displayFont } from "../fonts";

export type CaptionEntrance = "up" | "in" | "scale";

export const SceneCaption: React.FC<{
  children: React.ReactNode;
  entrance?: CaptionEntrance;
}> = ({ children, entrance = "up" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name="Caption"
      style={{
        maxWidth: 920,
        color: "#f4f5fb",
        fontFamily: displayFont,
        fontSize: 48,
        lineHeight: 1.12,
        textAlign: "center",
        opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate:
          entrance === "up"
            ? interpolate(frame, [0, 0.45 * fps], ["0px 18px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 180 }),
              })
            : "0px 0px",
        scale:
          entrance === "scale"
            ? interpolate(frame, [0, 0.45 * fps], [0.94, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 180 }),
                output: "perceptual-scale",
              })
            : 1,
      }}
    >
      {children}
    </Interactive.Div>
  );
};
