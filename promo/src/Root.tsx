import "./index.css";
import { Composition, Folder, Still } from "remotion";
import { CaseyHoles } from "./CaseyHoles";
import { CaseyHook } from "./CaseyHook";
import { CaseyIntake } from "./CaseyIntake";
import { CaseyJourney } from "./CaseyJourney";
import { EndCard } from "./components/EndCard";
import { CreateCase } from "./scenes/CreateCase";
import { FormalizeDraft } from "./scenes/FormalizeDraft";
import { Headline } from "./scenes/Headline";
import { Interview } from "./scenes/Interview";
import { InviteWitness } from "./scenes/InviteWitness";
import { Logo } from "./scenes/Logo";
import { ReviewGaps } from "./scenes/ReviewGaps";
import { SignClose } from "./scenes/SignClose";
import { SourcesMerge } from "./scenes/SourcesMerge";
import { Thumbnail } from "./Thumbnail";
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
      <Still
        id="Thumbnail"
        component={Thumbnail}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Folder name="Casey-Promo-Scenes">
        <Composition
          id="Logo"
          component={Logo}
          durationInFrames={75}
          {...clip}
        />
        <Composition
          id="Headline"
          component={Headline}
          durationInFrames={180}
          {...clip}
        />
        <Composition
          id="CreateCase"
          component={CreateCase}
          durationInFrames={150}
          {...clip}
        />
        <Composition
          id="InviteWitness"
          component={InviteWitness}
          durationInFrames={120}
          {...clip}
        />
        <Composition
          id="Interview"
          component={Interview}
          durationInFrames={150}
          {...clip}
        />
        <Composition
          id="SourcesMerge"
          component={SourcesMerge}
          durationInFrames={165}
          {...clip}
        />
        <Composition
          id="FormalizeDraft"
          component={FormalizeDraft}
          durationInFrames={135}
          {...clip}
        />
        <Composition
          id="ReviewGaps"
          component={ReviewGaps}
          durationInFrames={120}
          {...clip}
        />
        <Composition
          id="SignClose"
          component={SignClose}
          durationInFrames={90}
          {...clip}
        />
        <Composition
          id="EndCard"
          component={EndCard}
          durationInFrames={100}
          {...clip}
        />
      </Folder>
    </>
  );
};
