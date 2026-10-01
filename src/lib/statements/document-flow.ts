/** Document drafting and signing stay in the product. They are not the path a firm or a lead uses. */
export const DOCUMENT_DRAFTING_DEPRECATED = true;

export function documentDraftingEnabled() {
  return !DOCUMENT_DRAFTING_DEPRECATED;
}

export function retainSignedStatement(status: string) {
  return status === "finalized" || status === "completed";
}

export function readAccountSummary(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as { summary?: unknown; accountSummary?: unknown };
  const summary = record.summary ?? record.accountSummary;
  return typeof summary === "string" ? summary.trim() : "";
}
