import { loadFont as loadLibreBaskerville } from "@remotion/google-fonts/LibreBaskerville";
import { loadFont as loadSourceSans3 } from "@remotion/google-fonts/SourceSans3";

export const { fontFamily: displayFont } = loadLibreBaskerville("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

export const { fontFamily: displayItalic } = loadLibreBaskerville("italic", {
  weights: ["400"],
  subsets: ["latin"],
});

export const { fontFamily: sansFont } = loadSourceSans3("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});
