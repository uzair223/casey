import "./index.css";
import { Composition, Folder, Still } from "remotion";
import { CaseyHoles } from "./CaseyHoles";
import { CaseyHook } from "./CaseyHook";
import { CaseyIntake } from "./CaseyIntake";
import { CaseyJourney } from "./CaseyJourney";
import { AdStill } from "./ads/AdStill";
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
          id="CaseyJourney"
          component={CaseyJourney}
          durationInFrames={1025}
          {...clip}
        />
        <Composition
          id="CaseyHook"
          component={CaseyHook}
          durationInFrames={480}
          {...clip}
        />
        <Composition
          id="CaseyIntake"
          component={CaseyIntake}
          durationInFrames={310}
          {...clip}
        />
        <Composition
          id="CaseyHoles"
          component={CaseyHoles}
          durationInFrames={310}
          {...clip}
        />
      </Folder>
      <Folder name="Ads">
        <Still
          id="Ad-Chasing"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "chasing" }}
        />
        <Still
          id="Ad-Thinking"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "thinking" }}
        />
        <Still
          id="Ad-Gaps"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "gaps" }}
        />
        <Still
          id="Ad-Markup"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "markup" }}
        />
        <Still
          id="Ad-Intake"
          component={AdStill}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ variant: "intake" }}
        />
      </Folder>
    </>
  );
};
