import type { StatementConfig } from "@/types";

const ADDRESS_REFUSAL =
  /\b(don'?t|do not|won'?t|will not|rather not|prefer not|can'?t|cannot|not sure|don'?t know|do not know|no idea)\b/i;

export function modelWitnessDetails(
  incoming: Record<string, string | null> | null | undefined,
) {
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming ?? {})) {
    if (typeof value === "string" && value.trim()) patch[key] = value.trim();
  }
  return patch;
}

export function statedOccupation(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const occupation = (value as { occupation?: unknown }).occupation;
  return typeof occupation === "string" ? occupation.trim() : "";
}

export function addressStillUnasked(params: {
  config: Pick<StatementConfig, "witnessMetadataFields">;
  witnessMetadata?: Record<string, unknown> | null;
  ignoredMissingDetails?: string[] | null;
}) {
  const field = params.config.witnessMetadataFields?.find(
    (item) => item.id === "address",
  );
  if (!field?.requiredOnIntake) return false;
  const value = params.witnessMetadata?.address;
  if (typeof value === "string" && value.trim()) return false;
  return !(params.ignoredMissingDetails ?? []).some(
    (item) => item.trim().toLowerCase() === "address",
  );
}

export function declinedToGiveAddress(
  previousQuestion: string,
  answer: string,
) {
  if (!/\baddress\b/i.test(previousQuestion)) return false;
  const text = answer.trim();
  if (!text || text.length > 180) return false;
  if (
    /\d/.test(text) &&
    /\b(street|road|lane|avenue|close|drive|way|place|court|house|flat)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  return ADDRESS_REFUSAL.test(text);
}
