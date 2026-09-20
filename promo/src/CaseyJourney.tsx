import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { EndCard } from "./components/EndCard";
import { Score } from "./components/Score";
import { fadeCut } from "./cut";
import { CreateCase } from "./scenes/CreateCase";
import { FormalizeDraft } from "./scenes/FormalizeDraft";
import { Interview } from "./scenes/Interview";
import { InviteWitness } from "./scenes/InviteWitness";
import { Logo } from "./scenes/Logo";
import { ReviewGaps } from "./scenes/ReviewGaps";
import { SignClose } from "./scenes/SignClose";
import { SourcesMerge } from "./scenes/SourcesMerge";

export const CaseyJourney: React.FC = () => {
  return (
    <AbsoluteFill>
      <Score />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={75} name="Logo">
          <Logo />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={150} name="CreateCase">
          <CreateCase showProgress />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={120} name="InviteWitness">
          <InviteWitness showProgress />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={150} name="Interview">
          <Interview showProgress />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={165} name="SourcesMerge">
          <SourcesMerge />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={135} name="FormalizeDraft">
          <FormalizeDraft showProgress />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={120} name="ReviewGaps">
          <ReviewGaps showProgress />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={90} name="SignClose">
          <SignClose showProgress />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={100} name="EndCard">
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
