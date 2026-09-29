export function modelWitnessDetails(
  incoming: Record<string, string | null> | null | undefined,
) {
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming ?? {})) {
    if (typeof value === "string" && value.trim()) patch[key] = value.trim();
  }
  return patch;
}
