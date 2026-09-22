export function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "";
}

export function isTrialWitnessCap(error: unknown) {
  return errorText(error).includes("trial_witness_cap");
}

export function isTrialTemplateCap(error: unknown) {
  return errorText(error).includes("trial_template_cap");
}
