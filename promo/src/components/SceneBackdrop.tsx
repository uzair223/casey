import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type BackdropMood =
  | "create"
  | "invite"
  | "interview"
  | "draft"
  | "review"
  | "logo";

type WashSpec = {
  name: string;
  left: number;
  top: number;
  size: number;
  color: string;
  from: string;
  to: string;
};

const moods: Record<BackdropMood, WashSpec[]> = {
  create: [
    {
      name: "Wash",
      left: -220,
      top: -80,
      size: 980,
      color: "rgba(154, 64, 52, 0.22)",
      from: "0px 0px",
      to: "48px 56px",
    },
    {
      name: "Wash 2",
      left: 420,
      top: 1180,
      size: 720,
      color: "rgba(154, 64, 52, 0.12)",
      from: "16px 0px",
      to: "-36px -48px",
    },
  ],
  logo: [
    {
      name: "Wash",
      left: -180,
      top: 40,
      size: 980,
      color: "rgba(154, 64, 52, 0.24)",
      from: "0px 12px",
      to: "40px -28px",
    },
    {
      name: "Wash 2",
      left: 420,
      top: 1100,
      size: 700,
      color: "rgba(154, 64, 52, 0.12)",
      from: "0px 0px",
      to: "-32px 40px",
    },
  ],
  invite: [
    {
      name: "Wash",
      left: 260,
      top: -40,
      size: 900,
      color: "rgba(154, 64, 52, 0.2)",
      from: "0px 16px",
      to: "-40px 56px",
    },
    {
      name: "Wash 2",
      left: -160,
      top: 1260,
      size: 640,
      color: "rgba(154, 64, 52, 0.1)",
      from: "0px 0px",
      to: "40px -48px",
    },
  ],
  interview: [
    {
      name: "Wash",
      left: -40,
      top: 180,
      size: 980,
      color: "rgba(154, 64, 52, 0.22)",
      from: "0px 0px",
      to: "32px 48px",
    },
    {
      name: "Wash 2",
      left: 380,
      top: 1240,
      size: 640,
      color: "rgba(196, 132, 120, 0.1)",
      from: "0px 16px",
      to: "-32px -48px",
    },
  ],
  draft: [
    {
      name: "Wash",
      left: 180,
      top: 400,
      size: 920,
      color: "rgba(154, 64, 52, 0.14)",
      from: "0px 0px",
      to: "-32px 40px",
    },
    {
      name: "Wash 2",
      left: -80,
      top: -60,
      size: 620,
      color: "rgba(154, 64, 52, 0.1)",
      from: "0px 0px",
      to: "36px 44px",
    },
  ],
  review: [
    {
      name: "Wash",
      left: 340,
      top: 860,
      size: 860,
      color: "rgba(154, 64, 52, 0.22)",
      from: "0px 16px",
      to: "-32px -48px",
    },
    {
      name: "Wash 2",
      left: -80,
      top: -40,
      size: 700,
      color: "rgba(154, 64, 52, 0.1)",
      from: "0px 0px",
      to: "28px 48px",
    },
  ],
};

const Wash: React.FC<WashSpec> = ({
  name,
  left,
  top,
  size,
  color,
  from,
  to,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <Interactive.Div
      name={name}
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, rgba(18, 17, 15, 0) 70%)`,
        translate: interpolate(frame, [0, durationInFrames], [from, to], {
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
  );
};

export const SceneBackdrop: React.FC<{ mood: BackdropMood }> = ({ mood }) => {
  return (
    <AbsoluteFill
      name="Background"
      style={{
        backgroundColor: "#12110f",
      }}
    >
      {moods[mood].map((wash) => (
        <Wash key={wash.name} {...wash} />
      ))}
    </AbsoluteFill>
  );
};
