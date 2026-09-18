export const JEV_MODEL = "typesafe/jev";
export const JEV_TIMEOUT_MS = 8_000;

export const JEV_CHOICE_CONFIDENCE_MIN = 0.45;
export const JEV_SCORE_CONFIDENCE_MIN = 0.45;
export const JEV_NOUL_STOP_MIN = 0.8;
export const JEV_NOUL_JAILBREAK_MIN = 0.8;
export const JEV_NOUL_READY_MIN = 0.75;
export const JEV_DEVIATION_STOP_COUNT = 3;

export const JEV_TRANSCRIPT_TURNS = 8;
export const JEV_TURN_TEXT_MAX_CHARS = 1_200;

export const JEV_ANALYSIS_ITEM_CAP = 20;
export const JEV_EXCERPT_MAX_CHARS = 400;
export const JEV_NOUL_AGREE_MIN = 0.6;
export const JEV_NOUL_CONTRADICTION_MIN = 0.6;
export const JEV_NOUL_MATERIAL_GAP_MIN = 0.55;
export const JEV_NOUL_CONFLICT_MIN = 0.6;

export const PHASE_COMPLETENESS_MAX_SCORE = 3;
export const CASE_COMPLETENESS_LEVELS = [
  "thin",
  "partial",
  "mostly",
  "trial-ready",
] as const;

export type CaseCompletenessLevel = (typeof CASE_COMPLETENESS_LEVELS)[number];
