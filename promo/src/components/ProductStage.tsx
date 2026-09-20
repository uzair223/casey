import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneCaption, type CaptionEntrance } from "./SceneCaption";

export type ProductEntrance = "tilt" | "rise" | "slideRight" | "scale" | "settle";
export type ProductTilt =
  | "fromAbove"
  | "fromBelow"
  | "fromLeft"
  | "fromRight"
  | "twist"
  | "yawSweep"
  | "flatten";

const defaultTilt: Record<ProductEntrance, ProductTilt> = {
  tilt: "fromLeft",
  rise: "fromBelow",
  slideRight: "fromRight",
  scale: "fromAbove",
  settle: "flatten",
};

const TILT = {
  fromAbove: {
    origin: "50% 58%",
    x: [6, 2.4, 1.1],
    y: [-2.2, -0.9, -0.4],
    z: [0, 0, 0],
  },
  fromBelow: {
    origin: "50% 46%",
    x: [-5.5, -2.2, -1],
    y: [1.8, 0.7, 0.3],
    z: [0, 0, 0],
  },
  fromLeft: {
    origin: "50% 56%",
    x: [2.4, 1.1, 0.5],
    y: [5, 2.2, 1.1],
    z: [-0.6, -0.2, 0],
  },
  fromRight: {
    origin: "50% 56%",
    x: [2.4, 1.1, 0.5],
    y: [-5, -2.2, -1.1],
    z: [0.6, 0.2, 0],
  },
  twist: {
    origin: "50% 50%",
    x: [3.8, 1.4, -0.4],
    y: [-4.5, -1.4, 1.2],
    z: [-0.8, -0.2, 0.2],
  },
  yawSweep: {
    origin: "50% 56%",
    x: [3.2, 1.2, 0.5],
    y: [4, 0.8, -1.4],
    z: [0.4, 0.1, -0.2],
  },
  flatten: {
    origin: "50% 58%",
    x: [4.5, 1.6, 0.4],
    y: [2.6, 0.9, 0.2],
    z: [-0.4, -0.1, 0],
  },
} as const;

export const ProductStage: React.FC<{
  children: React.ReactNode;
  name?: string;
  entrance?: ProductEntrance;
  tilt?: ProductTilt;
  caption?: React.ReactNode;
  captionEntrance?: CaptionEntrance;
}> = ({
  children,
  name = "Product",
  entrance = "tilt",
  tilt,
  caption,
  captionEntrance = "up",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pose = TILT[tilt ?? defaultTilt[entrance]];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 56,
        paddingBottom: 88,
        paddingLeft: 56,
        paddingRight: 56,
        perspective: "1800px",
      }}
    >
      {caption ? (
        <div style={{ marginBottom: 22, flexShrink: 0 }}>
          <SceneCaption entrance={captionEntrance}>{caption}</SceneCaption>
        </div>
      ) : null}
      <Interactive.Div
        name={name}
        style={{
          transformOrigin: pose.origin,
          opacity: interpolate(frame, [0.08 * fps, 0.42 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(
            frame,
            [0.08 * fps, 0.5 * fps],
            entrance === "rise"
              ? ["0px 28px", "0px 0px"]
              : entrance === "slideRight"
                ? ["36px 0px", "0px 0px"]
                : entrance === "settle"
                  ? ["0px 12px", "0px 0px"]
                  : ["0px 8px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 180 }),
            },
          ),
          scale: interpolate(
            frame,
            [0.08 * fps, 0.48 * fps, durationInFrames],
            entrance === "scale"
              ? [0.94, 1, 1.012]
              : entrance === "rise"
                ? [0.99, 1, 1.008]
                : [0.97, 1, 1.01],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: [
                Easing.spring({ damping: 190 }),
                Easing.bezier(0.22, 1, 0.36, 1),
              ],
              output: "perceptual-scale",
            },
          ),
        }}
      >
        <div
          style={{
            transformOrigin: pose.origin,
            transform: `perspective(1800px) rotateX(${interpolate(
              frame,
              [0, 0.55 * fps, durationInFrames],
              [...pose.x],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: [
                  Easing.spring({ damping: 180 }),
                  Easing.bezier(0.22, 1, 0.36, 1),
                ],
              },
            )}deg) rotateY(${interpolate(
              frame,
              [0, 0.6 * fps, durationInFrames],
              [...pose.y],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: [
                  Easing.spring({ damping: 180 }),
                  Easing.bezier(0.22, 1, 0.36, 1),
                ],
              },
            )}deg) rotateZ(${interpolate(
              frame,
              [0, 0.65 * fps, durationInFrames],
              [...pose.z],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: [
                  Easing.spring({ damping: 190 }),
                  Easing.bezier(0.22, 1, 0.36, 1),
                ],
              },
            )}deg)`,
          }}
        >
          {children}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
