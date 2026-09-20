import { Audio } from "@remotion/media";
import { interpolate, staticFile, useVideoConfig } from "remotion";

export const Score: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <Audio
      src={staticFile("score.mp3")}
      volume={(f) =>
        interpolate(
          f,
          [0, 0.8 * fps, durationInFrames - 1.4 * fps, durationInFrames],
          [0, 0.26, 0.26, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )
      }
    />
  );
};
