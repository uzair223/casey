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
import { sansFont } from "../fonts";

const chronology = [
  {
    time: "08:10",
    event: "Jane Doe arrives on site",
    sources: ["J. Doe"],
  },
  {
    time: "08:12",
    event: "Barrier drops and strikes left shoulder",
    sources: ["J. Doe", "J. Cole"],
  },
  {
    time: "08:20",
    event: "Incident reported to site supervisor",
    sources: ["J. Doe", "Supervisor"],
  },
] as const;

export const ReviewGaps: React.FC<{ showProgress?: boolean }> = ({
  showProgress = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="review" />
      {showProgress ? <ProgressRail active={4} /> : null}
      <ProductStage
        entrance="tilt"
        tilt="fromLeft"
        caption="Cross-check every witness on one timeline and expose the holes."
        captionEntrance="in"
      >
        <ProductFrame title="app.casey / cases / WA-2026-0314 / analysis">
          <div
            style={{
              height: "100%",
              padding: 20,
              fontFamily: sansFont,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 12,
                border: "1px solid rgba(244, 245, 251, 0.1)",
                backgroundColor: "rgba(26, 26, 26, 0.45)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(244, 245, 251, 0.1)",
                }}
              >
                <div>
                  <div style={{ color: "#f4f5fb", fontSize: 22, fontWeight: 500 }}>
                    Facts & gaps
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      color: "rgba(244, 245, 251, 0.45)",
                      fontSize: 14,
                    }}
                  >
                    Generated from 3 statements
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: 6,
                    border: "1px solid rgba(244, 245, 251, 0.15)",
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "rgba(244, 245, 251, 0.8)",
                  }}
                >
                  Regenerate
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "0 16px",
                  borderBottom: "1px solid rgba(244, 245, 251, 0.1)",
                  fontSize: 14,
                }}
              >
                {["Summary", "Chronology", "Facts", "Gaps", "Evidence"].map(
                  (tab) => (
                    <div
                      key={tab}
                      style={{
                        padding: "10px 0",
                        borderBottom:
                          tab === "Chronology"
                            ? "2px solid #f4f5fb"
                            : "2px solid transparent",
                        color:
                          tab === "Chronology"
                            ? "#f4f5fb"
                            : "rgba(244, 245, 251, 0.42)",
                      }}
                    >
                      {tab}
                    </div>
                  ),
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  padding: 16,
                  borderBottom: "1px solid rgba(244, 245, 251, 0.1)",
                }}
              >
                {[
                  ["4", "Shared facts"],
                  ["1", "Conflicts"],
                  ["3", "Open gaps"],
                  ["2", "Evidence"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    style={{
                      borderRadius: 6,
                      border: "1px solid rgba(244, 245, 251, 0.1)",
                      padding: "8px 12px",
                    }}
                  >
                    <div
                      style={{
                        color: "#f4f5fb",
                        fontSize: 28,
                        fontWeight: 600,
                      }}
                    >
                      {value}
                    </div>
                    <div
                      style={{
                        color: "rgba(244, 245, 251, 0.45)",
                        fontSize: 11,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                {chronology.map((row, index) => (
                  <Interactive.Div
                    key={row.time}
                    name={`Tick ${index + 1}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "88px 1fr",
                      gap: 8,
                      padding: "10px 16px",
                      borderBottom: "1px solid rgba(244, 245, 251, 0.08)",
                      opacity: interpolate(
                        frame,
                        [0.3 * fps + index * 0.25 * fps, 0.65 * fps + index * 0.25 * fps],
                        [0, 1],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        },
                      ),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        color: "#f4f5fb",
                        fontSize: 18,
                      }}
                    >
                      <span
                        style={{
                          marginTop: 6,
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "rgba(244, 245, 251, 0.6)",
                          flexShrink: 0,
                        }}
                      />
                      {row.time}
                    </div>
                    <div>
                      <div style={{ color: "#f4f5fb", fontSize: 18 }}>
                        {row.event}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        {row.sources.map((source) => (
                          <div
                            key={source}
                            style={{
                              borderRadius: 999,
                              backgroundColor: "rgba(244, 245, 251, 0.1)",
                              padding: "2px 8px",
                              fontSize: 14,
                              color: "rgba(244, 245, 251, 0.7)",
                            }}
                          >
                            {source}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Interactive.Div>
                ))}
                <Interactive.Div
                  name="Gap card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px 1fr",
                    gap: 8,
                    padding: "10px 16px",
                    opacity: interpolate(frame, [1.15 * fps, 1.6 * fps], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.bezier(0.16, 1, 0.3, 1),
                    }),
                    scale: interpolate(frame, [1.15 * fps, 1.6 * fps], [0.97, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.spring({ damping: 180 }),
                      output: "perceptual-scale",
                    }),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      color: "rgba(244, 245, 251, 0.5)",
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        marginTop: 6,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#fbbf24",
                        flexShrink: 0,
                      }}
                    />
                    Undated
                  </div>
                  <div
                    style={{
                      borderRadius: 6,
                      border: "1px solid rgba(245, 158, 11, 0.28)",
                      backgroundColor: "rgba(245, 158, 11, 0.08)",
                      padding: "8px 12px",
                    }}
                  >
                    <div style={{ color: "#f4f5fb", fontSize: 18 }}>
                      CCTV covering the loading bay has not been obtained
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {["J. Doe", "J. Cole", "Supervisor"].map((source) => (
                        <div
                          key={source}
                          style={{
                            borderRadius: 999,
                            backgroundColor: "rgba(245, 158, 11, 0.16)",
                            padding: "2px 8px",
                            fontSize: 14,
                            color: "rgba(251, 191, 36, 0.9)",
                          }}
                        >
                          {source}
                        </div>
                      ))}
                    </div>
                  </div>
                </Interactive.Div>
              </div>
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
