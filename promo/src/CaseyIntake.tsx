import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { EndCard } from "./components/EndCard";
import { Score } from "./components/Score";
import { fadeCut } from "./cut";
import { Interview } from "./scenes/Interview";
import { InviteWitness } from "./scenes/InviteWitness";

export const CaseyIntake: React.FC = () => {
  return (
    <AbsoluteFill>
      <Score />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90} name="InviteWitness">
          <InviteWitness showCaption={false} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={150} name="Interview">
          <Interview />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={90} name="EndCard">
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
