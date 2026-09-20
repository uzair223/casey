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

export const InviteWitness: React.FC<{
  showProgress?: boolean;
  showCaption?: boolean;
}> = ({ showProgress = false, showCaption = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="invite" />
      {showProgress ? <ProgressRail active={1} /> : null}
      <ProductStage
        entrance="slideRight"
        tilt="fromRight"
        caption={
          showCaption
            ? "Send them a private intake link that expires."
            : undefined
        }
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
                ["Jane Doe", "Draft", "jane.doe@email.com", true],
                ["James Cole", "Collecting", "j.cole@email.com", false],
                ["Site supervisor", "Draft", "—", false],
              ].map(([name, status, email, active]) => (
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
                        color: "rgba(244, 245, 251, 0.7)",
                        fontSize: 10,
                        border: "1px solid rgba(244, 245, 251, 0.15)",
                        borderRadius: 999,
                        padding: "2px 7px",
                      }}
                    >
                      {status}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      color: "rgba(244, 245, 251, 0.4)",
                      fontSize: 11,
                    }}
                  >
                    {email}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, padding: "20px 24px", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
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
                      marginTop: 4,
                      color: "#f4f5fb",
                      fontFamily: displayFont,
                      fontSize: 32,
                      lineHeight: 1.15,
                    }}
                  >
                    Workplace accident — 14 March 2026
                  </div>
                </div>
                <div
                  style={{
                    height: 36,
                    width: "fit-content",
                    padding: "0 12px",
                    borderRadius: 8,
                    backgroundColor: "#7357FF",
                    color: "#f4f5fb",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 13,
                    gap: 6,
                  }}
                >
                  Send intake link
                </div>
              </div>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 16,
                  borderBottom: "1px solid rgba(244, 245, 251, 0.1)",
                  fontSize: 18,
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
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {[
                  ["Full name", "Jane Doe"],
                  ["Email", "jane.doe@email.com"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(244, 245, 251, 0.45)",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        height: 40,
                        borderRadius: 8,
                        border: "1px solid rgba(244, 245, 251, 0.1)",
                        backgroundColor: "#1a1a1a",
                        padding: "0 12px",
                        display: "flex",
                        alignItems: "center",
                        fontSize: 14,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <Interactive.Div
                name="Link card"
                style={{
                  marginTop: 18,
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(115, 87, 255, 0.35)",
                  backgroundColor: "#1a1a1a",
                  padding: 16,
                  opacity: interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }),
                  translate: interpolate(
                    frame,
                    [1 * fps, 1.5 * fps],
                    ["28px 0px", "0px 0px"],
                    {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.spring({ damping: 180 }),
                    },
                  ),
                }}
              >
                <div
                  style={{
                    color: "#9B8CFF",
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  Intake link sent
                </div>
                <div style={{ marginTop: 8, color: "#f4f5fb", fontSize: 20 }}>
                  caseyhq.co.uk/intake/j4n3
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: "rgba(244, 245, 251, 0.5)",
                    fontSize: 13,
                  }}
                >
                  Expires in 7 days
                </div>
              </Interactive.Div>
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
