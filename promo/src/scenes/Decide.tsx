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
import { brand, card, cream, line, mute } from "../theme";

const leads = [
  {
    name: "Jane Doe",
    type: "Workplace accident",
    contact: "jane@example.com",
    confirmed: true,
  },
  {
    name: "Amir Shah",
    type: "Clinical negligence",
    contact: "amir@example.com",
    confirmed: true,
  },
] as const;

export const Decide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accepted = frame > 2.4 * fps;

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="create" />
      <ProductStage
        entrance="slideRight"
        tilt="fromRight"
        caption="You decide which become files."
        captionEntrance="in"
      >
        <ProductFrame title="app.casey / leads" height={760}>
          <div
            style={{
              height: "100%",
              padding: "22px 26px",
              fontFamily: sansFont,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              backgroundColor: "#12110f",
            }}
          >
            <div>
              <div
                style={{
                  color: "#c48478",
                  fontFamily: displayItalic,
                  fontSize: 20,
                }}
              >
                This morning
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: cream,
                  fontFamily: displayFont,
                  fontSize: 40,
                }}
              >
                Leads
              </div>
            </div>
            {leads.map((lead, index) => {
              const isJane = index === 0;
              return (
                <div
                  key={lead.name}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${isJane && accepted ? brand : line}`,
                    backgroundColor: card,
                    padding: "16px 18px",
                    opacity: isJane ? 1 : 0.55,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ color: cream, fontSize: 26 }}>{lead.name}</div>
                      <div style={{ marginTop: 4, color: mute, fontSize: 18 }}>{lead.type}</div>
                    </div>
                    <div
                      style={{
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 999,
                        border: `1px solid ${brand}`,
                        color: "#c48478",
                        display: "flex",
                        alignItems: "center",
                        fontSize: 15,
                      }}
                    >
                      Contact confirmed
                    </div>
                  </div>
                  <div style={{ marginTop: 8, color: mute, fontSize: 16 }}>{lead.contact}</div>
                  {isJane ? (
                    <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                      <Interactive.Div
                        name="Accept"
                        style={{
                          height: 44,
                          padding: "0 18px",
                          borderRadius: 999,
                          backgroundColor: brand,
                          color: cream,
                          display: "flex",
                          alignItems: "center",
                          fontSize: 18,
                          fontWeight: 600,
                          scale: interpolate(frame, [2.15 * fps, 2.45 * fps], [1, 0.96], {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                            easing: Easing.bezier(0.16, 1, 0.3, 1),
                            output: "perceptual-scale",
                          }),
                        }}
                      >
                        {accepted ? "Accepted" : "Accept lead"}
                      </Interactive.Div>
                      <div
                        style={{
                          height: 44,
                          padding: "0 18px",
                          borderRadius: 999,
                          border: `1px solid ${line}`,
                          color: cream,
                          display: "flex",
                          alignItems: "center",
                          fontSize: 18,
                          opacity: accepted ? 0.4 : 1,
                        }}
                      >
                        Decline
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
