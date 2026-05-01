export type UseCase =
  | "template-generation"
  | "docx-review"
  | "intake-chat"
  | "intake-greeting"
  | "case-analysis"
  | "formalize"
  | "document-descriptor"
  | "default";

const MODELS = {
  cheap: "openai/gpt-5.4-nano",
  smart: "openai/gpt-5.4-mini",
  deep: "openai/gpt-5.4-mini",
} as const;

const MODEL_BY_USE_CASE: Record<UseCase, string> = {
  "intake-greeting": MODELS.cheap,
  "intake-chat": MODELS.cheap,
  "template-generation": MODELS.smart,
  "docx-review": MODELS.smart,
  "case-analysis": MODELS.deep,
  formalize: MODELS.deep,
  "document-descriptor": MODELS.cheap,
  default: MODELS.cheap,
};

export const selectModel = (useCase: UseCase = "default") =>
  MODEL_BY_USE_CASE[useCase];
