import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { EndCard } from "./components/EndCard";
import { Score } from "./components/Score";
import { fadeCut } from "./cut";
import { FormalizeDraft } from "./scenes/FormalizeDraft";
import { SignClose } from "./scenes/SignClose";

export const CaseyDraft: React.FC = () => {
  return (
    <AbsoluteFill>
      <Score />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={300} name="Draft">
          <FormalizeDraft />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={180} name="Sign">
          <SignClose />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={140} name="EndCard">
          <EndCard line="Casey drafts the statement." />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
