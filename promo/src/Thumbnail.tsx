import { AbsoluteFill, Interactive } from "remotion";
import { SceneBackdrop } from "./components/SceneBackdrop";
import { BrandMark } from "./components/BrandMark";
import { displayFont, sansFont } from "./fonts";

export const Thumbnail: React.FC = () => {
  return (
    <AbsoluteFill>
      <SceneBackdrop mood="interview" />
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
        <BrandMark size={108} gradientId="thumb-mark" />
        <Interactive.Div
          name="Headline"
          style={{
            marginTop: 36,
            color: "#f4f5fb",
            fontFamily: displayFont,
            fontSize: 72,
            lineHeight: 1.08,
            textAlign: "center",
          }}
        >
          Your solicitors deserve their best thinking, not more chasing.
        </Interactive.Div>
        <Interactive.Div
          name="Tagline"
          style={{
            marginTop: 24,
            color: "rgba(244, 245, 251, 0.62)",
            fontFamily: sansFont,
            fontSize: 28,
            lineHeight: 1.35,
            textAlign: "center",
          }}
        >
          Join us today at CaseyHQ.co.uk
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
