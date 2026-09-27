const STATED_OCCUPATION =
  /\b(?:i(?:\s*am|'m)|i work as)\s+(?:a|an)\s+([a-z][a-z\s/-]{1,40}?)(?=\s+(?:and|at|who|when|but|,|\.)|\s*$)/i;

export function statedWitnessDetails(params: {
  userMessage: string;
  fieldIds: string[];
  existing?: Record<string, string | null | undefined> | null;
}) {
  const patch: Record<string, string> = {};
  if (!params.fieldIds.includes("occupation")) return patch;
  const current = params.existing?.occupation;
  if (typeof current === "string" && current.trim()) return patch;

  const occupation = params.userMessage
    .match(STATED_OCCUPATION)?.[1]
    ?.trim()
    .replace(/\s+/g, " ");
  if (occupation) patch.occupation = occupation;
  return patch;
}

export function mergeWitnessDetailPatch(
  incoming: Record<string, string | null> | null | undefined,
  stated: Record<string, string>,
) {
  const patch: Record<string, string> = { ...stated };
  for (const [key, value] of Object.entries(incoming ?? {})) {
    if (typeof value === "string" && value.trim()) {
      patch[key] = value.trim();
    }
  }
  return patch;
}
