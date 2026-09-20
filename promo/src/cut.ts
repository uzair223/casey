import { linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

export const fadeCut = {
  presentation: fade(),
  timing: linearTiming({ durationInFrames: 10 }),
};
