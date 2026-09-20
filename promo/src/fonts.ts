import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const { fontFamily: displayFont } = loadInstrumentSerif("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export const { fontFamily: sansFont } = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});
