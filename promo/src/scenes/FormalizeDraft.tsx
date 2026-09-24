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

const sections = [
  {
    heading: "1. Introduction",
    body: "I am the Claimant in these proceedings. This statement is true to the best of my knowledge and belief.",
  },
  {
    heading: "2. The incident",
    body: "On the morning of 14 March 2026 I arrived at the yard at approximately 08:10. As I passed the loading-bay barrier, it dropped without warning and struck my left shoulder.",
  },
  {
    heading: "3. Immediate aftermath",
    body: "I stopped work, reported the incident, and later attended for treatment. Photographs of the barrier are attached as exhibits.",
  },
] as const;

export const FormalizeDraft: React.FC<{
  showProgress?: boolean;
  showCaption?: boolean;
}> = ({ showProgress = false, showCaption = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="draft" />
      {showProgress ? <ProgressRail active={3} /> : null}
      <ProductStage
        entrance="settle"
        tilt="yawSweep"
        caption={
          showCaption
            ? "Casey drafts the statement from the account."
            : undefined
        }
        captionEntrance="up"
      >
        <ProductFrame title="app.casey / statements / jane-doe">
          <div style={{ display: "flex", height: "100%", fontFamily: sansFont }}>
            <div
              style={{
                width: 180,
                borderRight: "1px solid rgba(243, 239, 230, 0.1)",
                backgroundColor: "#12110f",
                padding: 12,
              }}
            >
              <div
                style={{
                  padding: "4px 8px 10px",
                  color: "rgba(243, 239, 230, 0.4)",
                    fontSize: 15,
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                }}
              >
                Witnesses
              </div>
              {[
                ["Jane Doe", "Review", true],
                ["James Cole", "Draft", false],
                ["Site supervisor", "Draft", false],
              ].map(([name, status, active]) => (
                <div
                  key={String(name)}
                  style={{
                    borderRadius: 8,
                    backgroundColor: active
                      ? "rgba(243, 239, 230, 0.1)"
                      : "transparent",
                    padding: "8px 10px",
                    marginBottom: 4,
                    opacity: active ? 1 : 0.7,
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ color: "#f3efe6", fontSize: 14 }}>{name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        border: "1px solid rgba(243, 239, 230, 0.15)",
                        borderRadius: 999,
                        padding: "2px 7px",
                        color: "rgba(243, 239, 230, 0.7)",
                      }}
                    >
                      {status}
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
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{ color: "rgba(243, 239, 230, 0.45)", fontSize: 13 }}
                  >
                    Drafted by Casey
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      color: "#f3efe6",
                      fontFamily: displayFont,
                      fontSize: 32,
                    }}
                  >
                    Jane Doe
                  </div>
                </div>
                <div
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 999,
                    backgroundColor: "#9a4034",
                    color: "#f3efe6",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Draft ready
                </div>
              </div>
              <Interactive.Div
                name="Follow-up"
                style={{
                  marginBottom: 12,
                  borderRadius: 10,
                  border: "1px solid rgba(245, 158, 11, 0.28)",
                  backgroundColor: "rgba(245, 158, 11, 0.08)",
                  padding: "10px 14px",
                  opacity: interpolate(frame, [2.1 * fps, 2.55 * fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }),
                  translate: interpolate(
                    frame,
                    [2.1 * fps, 2.55 * fps],
                    ["0px 12px", "0px 0px"],
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
                    color: "#fbbf24",
                    fontSize: 12,
                    letterSpacing: 1.6,
                  }}
                >
                  FOLLOW-UP
                </div>
                <div style={{ marginTop: 4, color: "#f3efe6", fontSize: 16 }}>
                  Name of the supervisor who took the report is missing.
                </div>
              </Interactive.Div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                  borderRadius: 12,
                  border: "1px solid rgba(243, 239, 230, 0.1)",
                  backgroundColor: "#ffffff",
                  color: "#12110f",
                  padding: "22px 28px",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 16,
                    letterSpacing: 3.2,
                    color: "rgba(18, 17, 15, 0.45)",
                  }}
                >
                  WITNESS STATEMENT
                </div>
                <div
                  style={{
                    marginTop: 8,
                    textAlign: "center",
                    fontFamily: displayFont,
                    fontSize: 28,
                  }}
                >
                  Jane Doe
                </div>
                <div
                  style={{
                    marginTop: 4,
                    textAlign: "center",
                    fontSize: 16,
                    color: "rgba(18, 17, 15, 0.45)",
                  }}
                >
                  Workplace accident — 14 March 2026
                </div>
                {sections.map((section, index) => (
                  <Interactive.Div
                    key={section.heading}
                    name={`Section ${index + 1}`}
                    style={{
                      marginTop: 14,
                      opacity: interpolate(
                        frame,
                        [0.45 * fps + index * 0.4 * fps, 0.85 * fps + index * 0.4 * fps],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.bezier(0.16, 1, 0.3, 1),
                        },
                      ),
                      translate: interpolate(
                        frame,
                        [0.45 * fps + index * 0.4 * fps, 0.85 * fps + index * 0.4 * fps],
                        ["0px 16px", "0px 0px"],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.spring({ damping: 180 }),
                        },
                      ),
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      {section.heading}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 17,
                        lineHeight: 1.45,
                        color: "rgba(18, 17, 15, 0.78)",
                      }}
                    >
                      {section.body}
                    </div>
                  </Interactive.Div>
                ))}
              </div>
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
