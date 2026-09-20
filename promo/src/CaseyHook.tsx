import { TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { EndCard } from "./components/EndCard";
import { Score } from "./components/Score";
import { fadeCut } from "./cut";
import { Headline } from "./scenes/Headline";
import { Logo } from "./scenes/Logo";
import { SourcesMerge } from "./scenes/SourcesMerge";

export const CaseyHook: React.FC = () => {
  return (
    <AbsoluteFill>
      <Score />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={75} name="Logo">
          <Logo />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={180} name="Headline">
          <Headline />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={165} name="SourcesMerge">
          <SourcesMerge />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition {...fadeCut} />
        <TransitionSeries.Sequence durationInFrames={90} name="EndCard">
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
