export type UseCase =
  | "template-generation"
  | "docx-review"
  | "intake-chat"
  | "intake-greeting"
  | "case-analysis"
  | "formalize"
  | "document-descriptor"
  | "default";

export const CLOUDFLARE_MODELS = {
  luna: "openai/gpt-5.6-luna",
  terra: "openai/gpt-5.6-terra",
  sonnet: "anthropic/claude-sonnet-5",
  flash: "google/gemini-3.8-flash",
} as const;

const MODEL_BY_USE_CASE: Record<UseCase, string> = {
  "intake-greeting": CLOUDFLARE_MODELS.luna,
  "intake-chat": CLOUDFLARE_MODELS.luna,
  "document-descriptor": CLOUDFLARE_MODELS.luna,
  formalize: CLOUDFLARE_MODELS.sonnet,
  "case-analysis": CLOUDFLARE_MODELS.flash,
  "template-generation": CLOUDFLARE_MODELS.terra,
  "docx-review": CLOUDFLARE_MODELS.terra,
  default: CLOUDFLARE_MODELS.luna,
};

export const selectModel = (useCase: UseCase = "default") =>
  MODEL_BY_USE_CASE[useCase];

export function selectDocumentDescriptorModel(kind: "text" | "media") {
  return kind === "media" ? CLOUDFLARE_MODELS.flash : CLOUDFLARE_MODELS.luna;
}
