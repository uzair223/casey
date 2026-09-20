import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { EndCard } from "./components/EndCard";
import { Score } from "./components/Score";
import { fadeCut } from "./cut";
import { FormalizeDraft } from "./scenes/FormalizeDraft";
import { ReviewGaps } from "./scenes/ReviewGaps";

export const CaseyHoles: React.FC = () => {
  return (
    <AbsoluteFill>
      <Score />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120} name="FormalizeDraft">
          <FormalizeDraft showCaption={false} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={120} name="ReviewGaps">
          <ReviewGaps />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={90} name="EndCard">
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
