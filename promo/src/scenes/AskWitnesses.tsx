import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ProductFrame } from "../components/ProductFrame";
import { ProductStage } from "../components/ProductStage";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { displayFont, displayItalic, sansFont } from "../fonts";
import { brand, card, cream, line, mute } from "../theme";

const people = [
  { name: "James Cole", detail: "Colleague, named in the account" },
  { name: "Site supervisor", detail: "Took the report. Name still missing." },
] as const;

export const AskWitnesses: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const asked = frame > 1.7 * fps;

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="invite" />
      <ProductStage
        entrance="settle"
        tilt="yawSweep"
        caption="Casey names the people. The firm chooses who to ask."
        captionEntrance="up"
      >
        <ProductFrame title="app.casey / leads / jane-doe" height={640}>
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
              Named in Jane&apos;s account
            </div>
            <div
              style={{
                marginTop: 4,
                color: cream,
                fontFamily: displayFont,
                fontSize: 40,
              }}
            >
              Who should Casey ask?
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {people.map((person, index) => {
                const primary = index === 0;
                return (
                  <div
                    key={person.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      borderRadius: 14,
                      border: `1px solid ${line}`,
                      backgroundColor: card,
                      padding: "16px 18px",
                    }}
                  >
                    <div>
                      <div style={{ color: cream, fontSize: 26 }}>{person.name}</div>
                      <div style={{ marginTop: 4, color: mute, fontSize: 18 }}>{person.detail}</div>
                    </div>
                    <Interactive.Div
                      name={primary ? "Ask James" : "Ask supervisor"}
                      style={{
                        height: 44,
                        padding: "0 16px",
                        borderRadius: 999,
                        backgroundColor: primary && asked ? brand : "transparent",
                        border: `1px solid ${primary && asked ? brand : line}`,
                        color: cream,
                        display: "flex",
                        alignItems: "center",
                        fontSize: 18,
                        fontWeight: 600,
                        flexShrink: 0,
                        opacity: primary
                          ? 1
                          : interpolate(frame, [0.4 * fps, 0.8 * fps], [0, 1], {
                              extrapolateLeft: "clamp",
                              extrapolateRight: "clamp",
                            }),
                        scale: primary
                          ? interpolate(frame, [1.45 * fps, 1.75 * fps], [1, 0.96], {
                              extrapolateLeft: "clamp",
                              extrapolateRight: "clamp",
                              output: "perceptual-scale",
                            })
                          : 1,
                      }}
                    >
                      {primary && asked ? "Asked" : "Ask"}
                    </Interactive.Div>
                  </div>
                );
              })}
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
