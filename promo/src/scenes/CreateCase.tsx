import {
  AbsoluteFill,
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

const CASE_TITLE = "Workplace accident — 14 March 2026";

export const CreateCase: React.FC<{ showProgress?: boolean }> = ({
  showProgress = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typedCount = Math.round(
    interpolate(frame, [0.45 * fps, 2.05 * fps], [0, CASE_TITLE.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const typedTitle = CASE_TITLE.slice(0, typedCount);
  const templateOn = frame > 2.15 * fps;

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="create" />
      {showProgress ? <ProgressRail active={0} /> : null}
      <ProductStage
        entrance="scale"
        tilt="fromAbove"
        caption="Open the case from your own template."
        captionEntrance="in"
      >
        <ProductFrame title="app.casey / cases / new">
          <div
            style={{
              padding: "28px 32px",
              fontFamily: sansFont,
              color: "#f4f5fb",
            }}
          >
            <div
              style={{
                color: "#9B8CFF",
                fontSize: 15,
                letterSpacing: 3.2,
                textTransform: "uppercase",
              }}
            >
              New case
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: displayFont,
                fontSize: 40,
              }}
            >
              Create a case
            </div>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 16, color: "rgba(244, 245, 251, 0.5)" }}>
                  Case name
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 52,
                    borderRadius: 8,
                    border: "1px solid rgba(115, 87, 255, 0.45)",
                    backgroundColor: "#1a1a1a",
                    padding: "0 14px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 20,
                  }}
                >
                  {typedTitle}
                  <span
                    style={{
                      width: 2,
                      height: 18,
                      marginLeft: 2,
                      backgroundColor: "#7357FF",
                      opacity: typedCount < CASE_TITLE.length ? 1 : 0,
                    }}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 16, color: "rgba(244, 245, 251, 0.5)" }}>
                  Case status
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 52,
                    borderRadius: 8,
                    border: "1px solid rgba(244, 245, 251, 0.12)",
                    backgroundColor: "#1a1a1a",
                    padding: "0 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 20,
                  }}
                >
                  Draft
                  <span style={{ color: "rgba(244, 245, 251, 0.35)" }}>▾</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 16, color: "rgba(244, 245, 251, 0.5)" }}>
                Case template
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 52,
                  borderRadius: 8,
                  border: templateOn
                    ? "1px solid rgba(115, 87, 255, 0.45)"
                    : "1px solid rgba(244, 245, 251, 0.12)",
                  backgroundColor: "#1a1a1a",
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 20,
                  color: templateOn ? "#f4f5fb" : "rgba(244, 245, 251, 0.35)",
                }}
              >
                {templateOn ? "Personal injury" : "Select case template"}
                <span style={{ color: "rgba(244, 245, 251, 0.35)" }}>▾</span>
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                borderRadius: 8,
                border: "1px solid rgba(244, 245, 251, 0.1)",
                padding: 14,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 500 }}>
                Assigned Team Members{" "}
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 400,
                    color: "rgba(244, 245, 251, 0.45)",
                  }}
                >
                  (optional)
                </span>
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 24,
                  fontSize: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      backgroundColor: "#7357FF",
                    }}
                  />
                  E. Clarke{" "}
                  <span style={{ color: "rgba(244, 245, 251, 0.4)" }}>
                    (Solicitor)
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: "1px solid rgba(244, 245, 251, 0.3)",
                    }}
                  />
                  T. Hughes{" "}
                  <span style={{ color: "rgba(244, 245, 251, 0.4)" }}>
                    (Paralegal)
                  </span>
                </div>
              </div>
            </div>
            <Interactive.Div
              name="Create button"
              style={{
                marginTop: 20,
                width: 168,
                height: 48,
                borderRadius: 8,
                backgroundColor: "#7357FF",
                color: "#f4f5fb",
                fontFamily: sansFont,
                fontSize: 18,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scale: interpolate(
                  frame,
                  [3 * fps, 3.2 * fps, 3.55 * fps],
                  [1, 0.96, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                ),
              }}
            >
              Create case
            </Interactive.Div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
