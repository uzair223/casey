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

const Bubble: React.FC<{
  role: "casey" | "jane";
  children: React.ReactNode;
}> = ({ role, children }) => {
  const isJane = role === "jane";
  return (
    <div style={{ display: "flex", justifyContent: isJane ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: 640,
          padding: "14px 18px",
          fontSize: 22,
          lineHeight: 1.4,
          color: isJane ? "#12110f" : cream,
          backgroundColor: isJane ? cream : card,
          border: isJane ? "none" : `1px solid ${line}`,
          borderRadius: isJane ? "24px 4px 24px 24px" : "4px 24px 24px 24px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const Enquiry: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <SceneBackdrop mood="interview" />
      <ProductStage
        entrance="rise"
        tilt="fromBelow"
        caption="Enquirers tell Casey what happened."
        captionEntrance="up"
      >
        <ProductFrame title="northbridge.caseyhq.co.uk">
          <div
            style={{
              height: "100%",
              padding: "22px 28px 18px",
              fontFamily: sansFont,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#12110f",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div
                  style={{
                    color: "#c48478",
                    fontFamily: displayItalic,
                    fontSize: 20,
                  }}
                >
                  Northbridge Law
                </div>
                <div
                  style={{
                    marginTop: 4,
                    color: cream,
                    fontFamily: displayFont,
                    fontSize: 36,
                  }}
                >
                  Tell us what happened
                </div>
              </div>
              <div style={{ color: mute, fontSize: 18 }}>9:04pm</div>
            </div>
            <div
              style={{
                marginTop: 22,
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 14,
              }}
            >
              <Bubble role="casey">
                Where were you immediately before the incident, in your own words?
              </Bubble>
              <Interactive.Div
                name="Reply"
                style={{
                  opacity: interpolate(frame, [0.7 * fps, 1.15 * fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }),
                  translate: interpolate(frame, [0.7 * fps, 1.15 * fps], ["0px 16px", "0px 0px"], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.spring({ damping: 180 }),
                  }),
                }}
              >
                <Bubble role="jane">
                  I arrived at the site around 08:10. The barrier dropped as I passed and struck my left shoulder.
                </Bubble>
              </Interactive.Div>
              <Interactive.Div
                name="Code"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 12,
                  border: `1px solid ${brand}`,
                  backgroundColor: "rgba(154, 64, 52, 0.14)",
                  padding: "14px 16px",
                  opacity: interpolate(frame, [2.3 * fps, 2.8 * fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  }),
                  scale: interpolate(frame, [2.3 * fps, 2.8 * fps], [0.96, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.spring({ damping: 180 }),
                    output: "perceptual-scale",
                  }),
                }}
              >
                <div
                  style={{
                    borderRadius: 8,
                    backgroundColor: brand,
                    color: cream,
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: 3,
                    padding: "8px 12px",
                  }}
                >
                  4819
                </div>
                <div>
                  <div style={{ color: cream, fontSize: 20 }}>Contact confirmed</div>
                  <div style={{ marginTop: 2, color: mute, fontSize: 16 }}>
                    Code sent to jane@example.com
                  </div>
                </div>
              </Interactive.Div>
            </div>
          </div>
        </ProductFrame>
      </ProductStage>
    </AbsoluteFill>
  );
};
