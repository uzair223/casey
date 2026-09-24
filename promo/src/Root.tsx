import "./index.css";
import { Composition, Folder, Still } from "remotion";
import { AdStill } from "./ads/AdStill";
import { CaseyAccounts } from "./CaseyAccounts";
import { CaseyAnalysis } from "./CaseyAnalysis";
import { CaseyDraft } from "./CaseyDraft";
import { CaseyLeads } from "./CaseyLeads";
import { VIDEO } from "./video";

const clip = {
  fps: VIDEO.fps,
  width: VIDEO.width,
  height: VIDEO.height,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Clips">
        <Composition
          id="CaseyLeads"
          component={CaseyLeads}
          durationInFrames={600}
          {...clip}
        />
        <Composition
          id="CaseyAccounts"
          component={CaseyAccounts}
          durationInFrames={600}
          {...clip}
        />
        <Composition
          id="CaseyDraft"
          component={CaseyDraft}
          durationInFrames={600}
          {...clip}
        />
        <Composition
          id="CaseyAnalysis"
          component={CaseyAnalysis}
          durationInFrames={600}
          {...clip}
        />
      </Folder>
      <Folder name="Ads">
        <Still
          id="Ad-Leads"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "leads" }}
        />
        <Still
          id="Ad-Accept"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "accept" }}
        />
        <Still
          id="Ad-Account"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "account" }}
        />
        <Still
          id="Ad-Draft"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "draft" }}
        />
        <Still
          id="Ad-Analysis"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "analysis" }}
        />
      </Folder>
    </>
  );
};
