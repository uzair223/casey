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
import { ProgressRail } from "../components/ProgressRail";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { displayFont, sansFont } from "../fonts";

export const SignClose: React.FC<{ showProgress?: boolean }> = ({
  showProgress = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const signed = frame > 1.85 * fps;

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="review" />
      {showProgress ? <ProgressRail active={5} /> : null}
      <ProductStage
        entrance="rise"
        tilt="flatten"
        caption="Finalise each statement with a secure e-signature."
        captionEntrance="up"
      >
        <ProductFrame title="app.casey / cases / WA-2026-0314">
          <div style={{ display: "flex", height: "100%", fontFamily: sansFont }}>
            <div
              style={{
                width: 180,
                borderRight: "1px solid rgba(244, 245, 251, 0.1)",
                backgroundColor: "#101010",
                padding: 12,
              }}
            >
              <div
                style={{
                  padding: "4px 8px 10px",
                  color: "rgba(244, 245, 251, 0.4)",
                  fontSize: 11,
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                }}
              >
                Witnesses
              </div>
              {[
                ["Jane Doe", true],
                ["James Cole", false],
                ["Site supervisor", false],
              ].map(([name, active]) => (
                <div
                  key={String(name)}
                  style={{
                    borderRadius: 8,
                    backgroundColor: active
                      ? "rgba(244, 245, 251, 0.1)"
                      : "transparent",
                    padding: "8px 10px",
                    marginBottom: 4,
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: "#f4f5fb", fontSize: 14 }}>{name}</span>
                    <span
                      style={{
                        color:
                          active && signed
                            ? "#f4f5fb"
                            : "rgba(244, 245, 251, 0.7)",
                        backgroundColor:
                          active && signed ? "#7357FF" : "transparent",
                        fontSize: 10,
                        border:
                          active && signed
                            ? "1px solid #7357FF"
                            : "1px solid rgba(244, 245, 251, 0.15)",
                        borderRadius: 999,
                        padding: "2px 7px",
                      }}
                    >
                      {active ? (signed ? "Signed" : "Review") : "Draft"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                flex: 1,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{ color: "rgba(244, 245, 251, 0.45)", fontSize: 13 }}
                  >
                    Jane Doe · Details
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      color: "#f4f5fb",
                      fontFamily: displayFont,
                      fontSize: 32,
                      lineHeight: 1.15,
                    }}
                  >
                    Ready for solicitor review
                  </div>
                </div>
                <div
                  style={{
                    height: 34,
                    width: "fit-content",
                    padding: "0 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(244, 245, 251, 0.15)",
                    color: "#f4f5fb",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  Finalize and request e-signature
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  borderBottom: "1px solid rgba(244, 245, 251, 0.1)",
                  fontSize: 18,
                  marginBottom: 14,
                }}
              >
                {["Details", "Documents", "Follow-up", "Issues"].map(
                  (tab, index) => (
                    <div
                      key={tab}
                      style={{
                        paddingBottom: 10,
                        borderBottom:
                          index === 0
                            ? "2px solid #f4f5fb"
                            : "2px solid transparent",
                        color:
                          index === 0 ? "#f4f5fb" : "rgba(244, 245, 251, 0.42)",
                      }}
                    >
                      {tab}
                    </div>
                  ),
                )}
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    backgroundColor: "#ffffff",
                    color: "#101010",
                    borderRadius: 12,
                    padding: "22px 28px",
                    boxShadow: "0 20px 40px -28px rgba(0,0,0,0.8)",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 15,
                      letterSpacing: 3.2,
                      color: "rgba(16, 16, 16, 0.45)",
                    }}
                  >
                    WITNESS STATEMENT
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      textAlign: "center",
                      fontFamily: displayFont,
                      fontSize: 32,
                    }}
                  >
                    Jane Doe
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      textAlign: "center",
                      fontSize: 16,
                      color: "rgba(16, 16, 16, 0.45)",
                    }}
                  >
                    Workplace accident — 14 March 2026
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      fontSize: 18,
                      lineHeight: 1.45,
                      color: "rgba(16, 16, 16, 0.75)",
                    }}
                  >
                    I believe that the facts stated in this witness statement are
                    true.
                  </div>
                  <svg
                    viewBox="0 0 280 70"
                    width={200}
                    height={50}
                    style={{ marginTop: 14 }}
                  >
                    <Interactive.Path
                      name="Signature"
                      d="M12 44C28 18 44 58 62 36C78 16 86 48 112 40C140 30 148 18 176 28C198 36 220 22 248 34"
                      fill="none"
                      stroke="#2D35E8"
                      strokeWidth={3}
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 420,
                        strokeDashoffset: interpolate(
                          frame,
                          [0.55 * fps, 1.65 * fps],
                          [420, 0],
                          {
                            extrapolateLeft: "clamp",
                            extrapolateRight: "clamp",
                            easing: Easing.bezier(0.16, 1, 0.3, 1),
                          },
                        ),
                      }}
                    />
                  </svg>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        height: 28,
                        padding: "0 10px",
                        borderRadius: 6,
                        backgroundColor: signed
                          ? "rgba(115, 87, 255, 0.12)"
                          : "rgba(16, 16, 16, 0.06)",
                        color: signed ? "#2D35E8" : "rgba(16, 16, 16, 0.55)",
                        display: "flex",
                        alignItems: "center",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {signed ? "Signed with secure e-signature" : "Awaiting secure e-signature"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(16, 16, 16, 0.45)" }}>
                    Jane Doe · 19 September 2026
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
