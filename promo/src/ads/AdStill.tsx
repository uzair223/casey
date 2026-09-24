import { AbsoluteFill, Interactive, useVideoConfig } from "remotion";
import { SceneBackdrop } from "../components/SceneBackdrop";
import { BrandMark } from "../components/BrandMark";
import { ProductFrame } from "../components/ProductFrame";
import { displayFont, displayItalic, sansFont } from "../fonts";
import { brand, card, cream, ink, line, mute } from "../theme";

export type AdVariant = "leads" | "accept" | "account" | "draft" | "analysis";

export type AdStillProps = {
  variant: AdVariant;
};

const copy: Record<AdVariant, { headline: string; size: number; cream?: boolean }> = {
  leads: { headline: "Leads worth opening.", size: 92 },
  accept: { headline: "Pay for the leads you accept.", size: 78, cream: true },
  account: { headline: "Every enquiry answered.", size: 64 },
  draft: { headline: "Casey drafts the statement.", size: 64 },
  analysis: {
    headline: "The facts are on the file before review starts.",
    size: 52,
  },
};

const Bubble: React.FC<{ role: "casey" | "jane"; children: React.ReactNode }> = ({
  role,
  children,
}) => {
  const isJane = role === "jane";
  return (
    <div style={{ display: "flex", justifyContent: isJane ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: 720,
          padding: "12px 16px",
          fontSize: 20,
          lineHeight: 1.35,
          fontFamily: sansFont,
          color: isJane ? ink : cream,
          backgroundColor: isJane ? cream : card,
          border: isJane ? "none" : `1px solid ${line}`,
          borderRadius: isJane ? "20px 4px 20px 20px" : "4px 20px 20px 20px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const AccountCard: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  return (
    <ProductFrame title="northbridge.caseyhq.co.uk" width={width} height={height}>
      <div
        style={{
          height: "100%",
          padding: "22px 24px",
          fontFamily: sansFont,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          backgroundColor: ink,
        }}
      >
        <div style={{ color: "#c48478", fontFamily: displayItalic, fontSize: 18 }}>
          Northbridge Law · 9:04pm
        </div>
        <div style={{ color: cream, fontFamily: displayFont, fontSize: 36 }}>
          Tell us what happened
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
          <Bubble role="casey">
            Where were you immediately before the incident, in your own words?
          </Bubble>
          <Bubble role="jane">
            I arrived at the site around 08:10. The barrier dropped as I passed and struck my left shoulder.
          </Bubble>
        </div>
      </div>
    </ProductFrame>
  );
};

const DraftCard: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  return (
    <ProductFrame title="app.casey / statements / jane-doe" width={width} height={height}>
      <div style={{ height: "100%", padding: 18, backgroundColor: ink, fontFamily: sansFont }}>
        <div
          style={{
            borderRadius: 12,
            backgroundColor: "#ffffff",
            color: ink,
            padding: "22px 26px 28px",
            overflow: "hidden",
          }}
        >
          <div style={{ textAlign: "center", letterSpacing: 3, fontSize: 13, color: "rgba(18, 17, 15, 0.45)" }}>
            WITNESS STATEMENT
          </div>
          <div
            style={{
              marginTop: 8,
              textAlign: "center",
              fontFamily: displayFont,
              fontSize: 32,
              color: ink,
            }}
          >
            Jane Doe
          </div>
          {[
            ["1. Introduction", "I am the Claimant in these proceedings. This statement is true to the best of my knowledge and belief."],
            ["2. The incident", "On the morning of 14 March 2026 I arrived at the yard at approximately 08:10. The loading-bay barrier dropped and struck my left shoulder."],
            ["3. Immediate aftermath", "I reported the incident and later attended for treatment. Photographs of the barrier are attached."],
          ].map(([heading, body]) => (
            <div key={heading} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{heading}</div>
              <div style={{ marginTop: 4, fontSize: 15, lineHeight: 1.4, color: "rgba(18, 17, 15, 0.78)" }}>
                {body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProductFrame>
  );
};

const AnalysisCard: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const rows = [
    ["08:10", "Jane Doe arrives on site", "J. Doe"],
    ["08:12", "Barrier drops and strikes left shoulder", "J. Doe · J. Cole"],
    ["08:20", "Incident reported to site supervisor", "J. Doe"],
  ] as const;

  return (
    <ProductFrame title="app.casey / cases / WA-2026-0314 / analysis" width={width} height={height}>
      <div
        style={{
          height: "100%",
          padding: 18,
          fontFamily: sansFont,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          backgroundColor: ink,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ color: cream, fontSize: 26, fontWeight: 600 }}>Facts & gaps</div>
            <div style={{ marginTop: 2, color: mute, fontSize: 15 }}>Generated from 2 accounts</div>
          </div>
          <div style={{ color: "#c48478", fontSize: 15 }}>1 conflict · 3 gaps</div>
        </div>
        {rows.map(([time, event, source]) => (
          <div
            key={time}
            style={{
              display: "grid",
              gridTemplateColumns: "72px 1fr",
              gap: 10,
              paddingTop: 10,
              borderTop: `1px solid ${line}`,
            }}
          >
            <div style={{ color: cream, fontSize: 18 }}>{time}</div>
            <div>
              <div style={{ color: cream, fontSize: 18 }}>{event}</div>
              <div style={{ marginTop: 4, color: mute, fontSize: 14 }}>{source}</div>
            </div>
          </div>
        ))}
        <div
          style={{
            marginTop: 4,
            borderRadius: 10,
            border: "1px solid rgba(245, 158, 11, 0.28)",
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            padding: "10px 12px",
            color: cream,
            fontSize: 16,
          }}
        >
          Name of the supervisor who took the report is missing.
        </div>
      </div>
    </ProductFrame>
  );
};

export const AdStill: React.FC<AdStillProps> = ({ variant }) => {
  const { width } = useVideoConfig();
  const spec = copy[variant];
  const product = variant === "account" || variant === "draft" || variant === "analysis";
  const padX = 48;
  const inkOnCream = Boolean(spec.cream);
  const typeColor = inkOnCream ? ink : cream;
  const muteColor = inkOnCream ? "rgba(18, 17, 15, 0.55)" : mute;

  return (
    <AbsoluteFill>
      {inkOnCream ? (
        <AbsoluteFill style={{ backgroundColor: cream }} />
      ) : (
        <SceneBackdrop mood={variant === "analysis" ? "review" : variant === "draft" ? "draft" : "logo"} />
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
        {product ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BrandMark size={44} color={cream} />
            <div style={{ color: cream, fontFamily: displayFont, fontSize: 34, lineHeight: 1 }}>
              Casey
            </div>
          </div>
        ) : (
          <BrandMark size={132} color={inkOnCream ? brand : cream} />
        )}
        <Interactive.Div
          name="Headline"
          style={{
            marginTop: product ? 20 : 28,
            color: typeColor,
            fontFamily: displayFont,
            fontSize: spec.size,
            lineHeight: 1.08,
            textAlign: "center",
            maxWidth: 980,
          }}
        >
          {spec.headline}
        </Interactive.Div>
        {product ? (
          <div style={{ marginTop: 22 }}>
            {variant === "account" ? (
              <AccountCard width={width - padX * 2} height={520} />
            ) : variant === "draft" ? (
              <DraftCard width={width - padX * 2} height={640} />
            ) : (
              <AnalysisCard width={width - padX * 2} height={620} />
            )}
          </div>
        ) : null}
        <div
          style={{
            marginTop: product ? 22 : 32,
            color: muteColor,
            fontFamily: sansFont,
            fontSize: 30,
          }}
        >
          caseyhq.co.uk
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
