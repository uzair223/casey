import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ProductFrame } from "../components/ProductFrame";
import { ProductStage } from "../components/ProductStage";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { displayFont, displayItalic, sansFont } from "../fonts";
import { card, cream, line, mute } from "../theme";

const accounts = [
  { name: "Jane Doe", role: "Claimant", detail: "Account sent, with the barrier photo." },
  { name: "James Cole", role: "Colleague", detail: "Account sent. Saw the barrier drop." },
] as const;

export const OnTheFile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="review" />
      <ProductStage
        entrance="scale"
        tilt="fromAbove"
        caption="Both accounts sit on one matter."
        captionEntrance="scale"
      >
        <ProductFrame title="app.casey / cases / WA-2026-0314" height={640}>
          <div
            style={{
              height: "100%",
              padding: "22px 26px",
              fontFamily: sansFont,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#12110f",
            }}
          >
            <div
              style={{
                color: "#c48478",
                fontFamily: displayItalic,
                fontSize: 20,
              }}
            >
              Workplace accident
            </div>
            <div
              style={{
                marginTop: 4,
                color: cream,
                fontFamily: displayFont,
                fontSize: 40,
              }}
            >
              14 March 2026
            </div>
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              {accounts.map((account, index) => (
                <Interactive.Div
                  key={account.name}
                  name={account.name}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${line}`,
                    backgroundColor: card,
                    padding: "18px 20px",
                    opacity: interpolate(
                      frame,
                      [0.35 * fps + index * 0.35 * fps, 0.8 * fps + index * 0.35 * fps],
                      [0, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.bezier(0.16, 1, 0.3, 1),
                      },
                    ),
                    translate: interpolate(
                      frame,
                      [0.35 * fps + index * 0.35 * fps, 0.8 * fps + index * 0.35 * fps],
                      ["0px 18px", "0px 0px"],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.spring({ damping: 180 }),
                      },
                    ),
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ color: cream, fontSize: 28 }}>{account.name}</div>
                    <div style={{ color: mute, fontSize: 16 }}>{account.role}</div>
                  </div>
                  <div style={{ marginTop: 8, color: mute, fontSize: 18 }}>{account.detail}</div>
                </Interactive.Div>
              ))}
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
