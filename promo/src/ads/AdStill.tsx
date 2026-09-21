import { AbsoluteFill, Interactive, useVideoConfig } from "remotion";
import { SceneBackdrop, type BackdropMood } from "../components/SceneBackdrop";
import { BrandMark } from "../components/BrandMark";
import { ProductFrame } from "../components/ProductFrame";
import { displayFont, sansFont } from "../fonts";

export type AdVariant = "chasing" | "thinking" | "gaps" | "markup" | "intake";

export type AdStillProps = {
  variant: AdVariant;
};

const copy: Record<
  AdVariant,
  {
    mood: BackdropMood | "cream";
    headline: string;
    headlineSize: number;
  }
> = {
  chasing: {
    mood: "logo",
    headline: "Witness statements without the chasing.",
    headlineSize: 84,
  },
  thinking: {
    mood: "cream",
    headline: "Your solicitors deserve their best thinking, not more chasing.",
    headlineSize: 72,
  },
  gaps: {
    mood: "review",
    headline: "Find the gaps before they reach review.",
    headlineSize: 48,
  },
  markup: {
    mood: "draft",
    headline: "Let the evidence write the first draft.",
    headlineSize: 52,
  },
  intake: {
    mood: "interview",
    headline: "Casey fills the gaps before you have to chase.",
    headlineSize: 48,
  },
};

const CreamBackdrop: React.FC = () => {
  return (
    <AbsoluteFill
      name="Background"
      style={{
        backgroundColor: "#f4f5fb",
        overflow: "hidden",
      }}
    >
      <Interactive.Div
        name="Wash"
        style={{
          position: "absolute",
          left: -80,
          top: 80,
          width: 980,
          height: 980,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(115, 87, 255, 0.16) 0%, rgba(244, 245, 251, 0) 70%)",
        }}
      />
      <Interactive.Div
        name="Wash 2"
        style={{
          position: "absolute",
          left: 220,
          top: 720,
          width: 820,
          height: 820,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(45, 53, 232, 0.12) 0%, rgba(244, 245, 251, 0) 70%)",
        }}
      />
    </AbsoluteFill>
  );
};

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

const HolesCard: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  return (
    <ProductFrame
      title="app.casey / cases / WA-2026-0314 / analysis"
      width={width}
      height={height}
    >
      <div
        style={{
          padding: 22,
          fontFamily: sansFont,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: "#f4f5fb", fontSize: 26, fontWeight: 500 }}>
              Facts & gaps
            </div>
            <div
              style={{
                marginTop: 2,
                color: "rgba(244, 245, 251, 0.45)",
                fontSize: 16,
              }}
            >
              Cross-checked from 3 statements
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              borderRadius: 6,
              border: "1px solid rgba(251, 191, 36, 0.35)",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              padding: "8px 12px",
              fontSize: 15,
              color: "#fbbf24",
              fontWeight: 500,
            }}
          >
            3 open gaps
          </div>
        </div>
        {chronology.map((row) => (
          <div
            key={row.time}
            style={{
              display: "grid",
              gridTemplateColumns: "84px 1fr",
              gap: 10,
              padding: "12px 0",
              borderTop: "1px solid rgba(244, 245, 251, 0.08)",
            }}
          >
            <div style={{ color: "#f4f5fb", fontSize: 20 }}>{row.time}</div>
            <div>
              <div style={{ color: "#f4f5fb", fontSize: 20, lineHeight: 1.3 }}>
                {row.event}
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {row.sources.map((source) => (
                  <div
                    key={source}
                    style={{
                      borderRadius: 999,
                      backgroundColor: "rgba(244, 245, 251, 0.1)",
                      padding: "3px 10px",
                      fontSize: 15,
                      color: "rgba(244, 245, 251, 0.7)",
                    }}
                  >
                    {source}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(245, 158, 11, 0.28)",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#fbbf24",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#fbbf24",
              }}
            />
            Undated
          </div>
          <div
            style={{
              marginTop: 8,
              color: "#f4f5fb",
              fontSize: 22,
              lineHeight: 1.35,
            }}
          >
            CCTV covering the loading bay has not been obtained
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["J. Doe", "J. Cole", "Supervisor"].map((source) => (
              <div
                key={source}
                style={{
                  borderRadius: 999,
                  backgroundColor: "rgba(245, 158, 11, 0.16)",
                  padding: "3px 10px",
                  fontSize: 15,
                  color: "rgba(251, 191, 36, 0.9)",
                }}
              >
                {source}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProductFrame>
  );
};

const statementSections = [
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

const MarkupCard: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  return (
    <ProductFrame
      title="app.casey / statements / jane-doe"
      width={width}
      height={height}
    >
      <div
        style={{
          height: "100%",
          padding: 18,
          fontFamily: sansFont,
        }}
      >
        <div
          style={{
            position: "relative",
            height: "100%",
            overflow: "hidden",
            borderRadius: 12,
            backgroundColor: "#ffffff",
            color: "#101010",
            padding: "24px 28px",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 14,
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
              fontSize: 36,
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
          {statementSections.map((section) => (
            <div key={section.heading} style={{ marginTop: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{section.heading}</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 18,
                  lineHeight: 1.45,
                  color: "rgba(16, 16, 16, 0.78)",
                }}
              >
                {section.body}
              </div>
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 88,
              background:
                "linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))",
            }}
          />
        </div>
      </div>
    </ProductFrame>
  );
};

const Bubble: React.FC<{
  role: "casey" | "jane";
  children: React.ReactNode;
}> = ({ role, children }) => {
  const isJane = role === "jane";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isJane ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          padding: "16px 20px",
          fontSize: 22,
          lineHeight: 1.4,
          color: isJane ? "#101010" : "#f4f5fb",
          backgroundColor: isJane ? "#f4f5fb" : "rgba(26, 26, 26, 0.92)",
          border: isJane ? "none" : "1px solid rgba(244, 245, 251, 0.1)",
          borderRadius: isJane ? "24px 4px 24px 24px" : "4px 24px 24px 24px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const IntakeCard: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  return (
    <ProductFrame title="app.casey / intake" width={width} height={height}>
      <div
        style={{
          height: "100%",
          padding: "18px 22px 16px",
          fontFamily: sansFont,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#141414",
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
          Northbridge Law Witness intake
        </div>
        <div
          style={{
            marginTop: 4,
            color: "#f4f5fb",
            fontFamily: displayFont,
            fontSize: 32,
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
            border: "1px solid rgba(244, 245, 251, 0.1)",
            backgroundColor: "rgba(26, 26, 26, 0.45)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 18,
              padding: "0 16px",
              borderBottom: "1px solid rgba(244, 245, 251, 0.1)",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {["Chat", "Evidence", "Review"].map((tab, index) => (
              <div
                key={tab}
                style={{
                  padding: "10px 0",
                  borderBottom:
                    index === 0 ? "2px solid #f4f5fb" : "2px solid transparent",
                  color: index === 0 ? "#f4f5fb" : "rgba(244, 245, 251, 0.42)",
                }}
              >
                {tab}
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 12,
            }}
          >
            <Bubble role="casey">
              What was your role at Northbridge Logistics on 14 March?
            </Bubble>
            <Bubble role="jane">Warehouse operative. Early shift, six till two.</Bubble>
            <Bubble role="casey">
              Where were you immediately before the barrier dropped?
            </Bubble>
            <Bubble role="jane">
              I&apos;d just come through the loading bay. The barrier came down
              as I passed and caught my left shoulder.
            </Bubble>
            <Bubble role="casey">
              Do you have photographs of the barrier, or anyone who saw it fall?
            </Bubble>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(244, 245, 251, 0.12)",
                  backgroundColor: "rgba(244, 245, 251, 0.06)",
                  padding: "10px 14px",
                  color: "#f4f5fb",
                  fontSize: 18,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                    stroke="rgba(244,245,251,0.7)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Barrier-14-Mar.jpg
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderTop: "1px solid rgba(244, 245, 251, 0.1)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 48,
                borderRadius: 8,
                border: "1px solid rgba(244, 245, 251, 0.1)",
                backgroundColor: "#141414",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                color: "rgba(244, 245, 251, 0.35)",
                fontSize: 16,
              }}
            >
              Type your response, attach files, or both...
            </div>
            <div
              style={{
                height: 48,
                padding: "0 18px",
                borderRadius: 8,
                backgroundColor: "#7357FF",
                color: "#f4f5fb",
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
  );
};

const product = (variant: AdVariant) =>
  variant === "gaps" || variant === "markup" || variant === "intake";

export const AdStill: React.FC<AdStillProps> = ({ variant }) => {
  const { width } = useVideoConfig();
  const spec = copy[variant];
  const dark = spec.mood !== "cream";
  const padX = 40;
  const showProduct = product(variant);
  const ink = dark ? "#f4f5fb" : "#101010";
  const mute = dark ? "rgba(244, 245, 251, 0.62)" : "rgba(16, 16, 16, 0.55)";
  const cardWidth = width - padX * 2;

  return (
    <AbsoluteFill>
      {spec.mood === "cream" ? (
        <CreamBackdrop />
      ) : (
        <SceneBackdrop mood={spec.mood} />
      )}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: padX,
          paddingRight: padX,
        }}
      >
        {showProduct ? (
          <Interactive.Div
            name="Brand"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <BrandMark size={44} gradientId={`ad-${variant}-mark`} />
            <div
              style={{
                color: ink,
                fontFamily: displayFont,
                fontSize: 34,
                lineHeight: 1,
              }}
            >
              Casey
            </div>
          </Interactive.Div>
        ) : (
          <BrandMark size={148} gradientId={`ad-${variant}-mark`} />
        )}
        <Interactive.Div
          name="Headline"
          style={{
            marginTop: showProduct ? 18 : 28,
            color: ink,
            fontFamily: displayFont,
            fontSize: spec.headlineSize,
            lineHeight: 1.08,
            textAlign: "center",
            maxWidth: 1000,
          }}
        >
          {spec.headline}
        </Interactive.Div>
        {showProduct ? (
          <Interactive.Div
            name="Product"
            style={{
              marginTop: 22,
              transform: "perspective(1800px) rotateX(1.2deg) rotateY(-0.8deg)",
            }}
          >
            {variant === "gaps" ? (
              <HolesCard width={cardWidth} height={700} />
            ) : variant === "intake" ? (
              <IntakeCard width={cardWidth} height={920} />
            ) : (
              <MarkupCard width={cardWidth} height={680} />
            )}
          </Interactive.Div>
        ) : null}
        <Interactive.Div
          name="URL"
          style={{
            marginTop: showProduct ? 20 : 28,
            color: mute,
            fontFamily: sansFont,
            fontSize: 30,
            letterSpacing: 0.2,
          }}
        >
          caseyhq.co.uk
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
