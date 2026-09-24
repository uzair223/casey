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

const Bubble: React.FC<{
  role: "casey" | "jane";
  children: React.ReactNode;
  faded?: boolean;
}> = ({ role, children, faded }) => {
  const isJane = role === "jane";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isJane ? "flex-end" : "flex-start",
        opacity: faded ? 0.42 : 1,
      }}
    >
      <div
        style={{
          maxWidth: 620,
          padding: "14px 18px",
          fontSize: 22,
          lineHeight: 1.4,
          color: isJane ? "#12110f" : "#f3efe6",
          backgroundColor: isJane ? "#f3efe6" : "rgba(26, 26, 26, 0.92)",
          border: isJane ? "none" : "1px solid rgba(243, 239, 230, 0.1)",
          borderRadius: isJane ? "24px 4px 24px 24px" : "4px 24px 24px 24px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const Interview: React.FC<{ showProgress?: boolean }> = ({
  showProgress = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="interview" />
      {showProgress ? <ProgressRail active={2} /> : null}
      <ProductStage
        entrance="rise"
        tilt="fromBelow"
        caption="Casey takes the account, and the photo comes with it."
        captionEntrance="scale"
      >
        <ProductFrame title="app.casey / intake">
          <div
            style={{
              height: "100%",
              padding: "18px 24px 16px",
              fontFamily: sansFont,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#12110f",
            }}
          >
            <div
              style={{
                color: "#c48478",
                fontSize: 15,
                letterSpacing: 3.2,
                textTransform: "uppercase",
              }}
            >
              Private account
            </div>
            <div
              style={{
                marginTop: 4,
                color: "#f3efe6",
                fontFamily: displayFont,
                fontSize: 36,
              }}
            >
              Workplace accident — 14 March 2026
            </div>
            <div
              style={{
                marginTop: 14,
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 12,
                border: "1px solid rgba(243, 239, 230, 0.1)",
                backgroundColor: "rgba(26, 26, 26, 0.45)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 18,
                  padding: "0 16px",
                  borderBottom: "1px solid rgba(243, 239, 230, 0.1)",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {["Chat", "Evidence", "Review"].map(
                  (tab, index) => (
                    <div
                      key={tab}
                      style={{
                        padding: "10px 0",
                        borderBottom:
                          index === 0
                            ? "2px solid #f3efe6"
                            : "2px solid transparent",
                        color:
                          index === 0 ? "#f3efe6" : "rgba(243, 239, 230, 0.42)",
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
                  minHeight: 0,
                  overflow: "hidden",
                  position: "relative",
                  padding: "10px 16px 0",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 36,
                    background:
                      "linear-gradient(to bottom, rgba(18, 17, 15, 0.92), rgba(18, 17, 15, 0))",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
                <Interactive.Div
                  name="Thread"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    translate: interpolate(
                      frame,
                      [0, 1.15 * fps, 2.05 * fps, 2.85 * fps],
                      ["0px -86px", "0px -132px", "0px -188px", "0px -236px"],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.bezier(0.22, 1, 0.36, 1),
                      },
                    ),
                  }}
                >
                  <Bubble role="casey" faded>
                    Can you confirm your full name and date of birth for the
                    statement heading?
                  </Bubble>
                  <Bubble role="jane" faded>
                    Jane Doe, 12 April 1989.
                  </Bubble>
                  <Bubble role="casey" faded>
                    What was your role at Northbridge Logistics on 14 March?
                  </Bubble>
                  <Bubble role="jane">
                    Warehouse operative. Early shift, six till two.
                  </Bubble>
                  <Bubble role="casey">
                    Where were you immediately before the barrier dropped?
                  </Bubble>
                  <Interactive.Div
                    name="Witness answer"
                    style={{
                      opacity: interpolate(
                        frame,
                        [0.85 * fps, 1.2 * fps],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.bezier(0.16, 1, 0.3, 1),
                        },
                      ),
                      translate: interpolate(
                        frame,
                        [0.85 * fps, 1.2 * fps],
                        ["0px 16px", "0px 0px"],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.spring({ damping: 180 }),
                        },
                      ),
                    }}
                  >
                    <Bubble role="jane">
                      I&apos;d just come through the loading bay. The barrier
                      came down as I passed and caught my left shoulder.
                    </Bubble>
                  </Interactive.Div>
                  <Interactive.Div
                    name="Follow-up"
                    style={{
                      opacity: interpolate(
                        frame,
                        [1.7 * fps, 2.1 * fps],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.bezier(0.16, 1, 0.3, 1),
                        },
                      ),
                      translate: interpolate(
                        frame,
                        [1.7 * fps, 2.1 * fps],
                        ["0px 16px", "0px 0px"],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.spring({ damping: 180 }),
                        },
                      ),
                    }}
                  >
                    <Bubble role="casey">
                      Thank you. Do you have photographs of the barrier, or
                      anyone who saw it fall?
                    </Bubble>
                  </Interactive.Div>
                  <Interactive.Div
                    name="Attachment"
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      opacity: interpolate(
                        frame,
                        [2.35 * fps, 2.75 * fps],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.bezier(0.16, 1, 0.3, 1),
                        },
                      ),
                      scale: interpolate(
                        frame,
                        [2.35 * fps, 2.75 * fps],
                        [0.92, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: Easing.spring({ damping: 180 }),
                          output: "perceptual-scale",
                        },
                      ),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 10,
                        border: "1px solid rgba(243, 239, 230, 0.12)",
                        backgroundColor: "rgba(243, 239, 230, 0.06)",
                        padding: "8px 12px",
                        color: "#f3efe6",
                        fontSize: 16,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                          stroke="rgba(243,239,230,0.7)"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Barrier-14-Mar.jpg
                    </div>
                  </Interactive.Div>
                  <Interactive.Div
                    name="Phase badges"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                      paddingTop: 4,
                      opacity: interpolate(
                        frame,
                        [2.55 * fps, 2.95 * fps],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        },
                      ),
                    }}
                  >
                    {[
                      ["✓ Background", true],
                      ["✓ Role", true],
                      ["○ Events", false],
                    ].map(([label, done]) => (
                      <div
                        key={String(label)}
                        style={{
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 15,
                          color: done ? "#f3efe6" : "rgba(243, 239, 230, 0.7)",
                          backgroundColor: done
                            ? "rgba(154, 64, 52, 0.28)"
                            : "rgba(243, 239, 230, 0.08)",
                          border: done
                            ? "1px solid rgba(154, 64, 52, 0.4)"
                            : "1px solid rgba(243, 239, 230, 0.12)",
                        }}
                      >
                        {label}
                      </div>
                    ))}
                    <span
                      style={{
                        fontSize: 15,
                        color: "rgba(243, 239, 230, 0.45)",
                        padding: "0 6px",
                      }}
                    >
                      2/5
                    </span>
                  </Interactive.Div>
                </Interactive.Div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 12,
                  borderTop: "1px solid rgba(243, 239, 230, 0.1)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 8,
                    border: "1px solid rgba(243, 239, 230, 0.1)",
                    backgroundColor: "#12110f",
                    padding: "0 12px",
                    display: "flex",
                    alignItems: "center",
                    color: "rgba(243, 239, 230, 0.35)",
                    fontSize: 16,
                  }}
                >
                  Type your response, attach files, or both...
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    border: "1px solid rgba(243, 239, 230, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                      stroke="rgba(243,239,230,0.5)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div
                  style={{
                    height: 48,
                    padding: "0 18px",
                    borderRadius: 8,
                    backgroundColor: "#9a4034",
                    color: "#f3efe6",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 18,
                    fontWeight: 500,
                  }}
                >
                  Send
                </div>
              </div>
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
