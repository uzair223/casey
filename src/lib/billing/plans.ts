export const FREE_LEAD_LIMIT = 3;
export const FREE_CASE_LIMIT = FREE_LEAD_LIMIT;

export const TRIAL_SEAT_LIMIT = 5;

export const STARTER_PRICE_GBP = 149;
export const STARTER_INCLUDED_USERS = 10;
export const STARTER_ACCEPTED_LEADS_PER_MONTH = 10;
export const STARTER_PUBLIC_TURNS_PER_DAY = 200;

export const GROWTH_PRICE_GBP = 349;
export const GROWTH_ACCEPTED_LEADS_PER_MONTH = 30;
export const GROWTH_PUBLIC_TURNS_PER_DAY = 800;

export const TRIAL_PUBLIC_TURNS_PER_DAY = 40;
export const EXTRA_LEAD_PRICE_GBP = 8;

export const PRACTICE_PRICE_GBP = STARTER_PRICE_GBP;
export const PRACTICE_SEAT_LIMIT = STARTER_INCLUDED_USERS;
export const PRACTICE_CASES_PER_MONTH = STARTER_ACCEPTED_LEADS_PER_MONTH;
export const FIRM_SEAT_PRICE_GBP = 49;
export const FIRM_MIN_SEATS = 6;
export const FIRM_CASES_PER_SEAT = 8;
export const EXTRA_CASE_PRICE_GBP = EXTRA_LEAD_PRICE_GBP;

export type TenantPlan =
  | "trial"
  | "starter"
  | "growth"
  | "practice"
  | "firm";

export type CaseGate =
  | "starter"
  | "growth"
  | "extra_lead"
  | "practice"
  | "firm"
  | "extra_case";

export function normalizeTenantPlan(
  value: string | null | undefined,
): "trial" | "starter" | "growth" {
  if (value === "starter" || value === "practice") return "starter";
  if (value === "growth" || value === "firm") return "growth";
  return "trial";
}

export function isTenantPlan(
  value: string | null | undefined,
): value is TenantPlan {
  return (
    value === "trial" ||
    value === "starter" ||
    value === "growth" ||
    value === "practice" ||
    value === "firm"
  );
}

export function isCaseGate(
  value: string | null | undefined,
): value is CaseGate {
  return (
    value === "starter" ||
    value === "growth" ||
    value === "extra_lead" ||
    value === "practice" ||
    value === "firm" ||
    value === "extra_case"
  );
}

export function planLabel(plan: string | null | undefined) {
  const normalized = normalizeTenantPlan(plan);
  if (normalized === "starter") return "Starter";
  if (normalized === "growth") return "Growth";
  return "Trial";
}

export function monthlyAcceptedLeadAllowance(plan: TenantPlan | string) {
  const normalized = normalizeTenantPlan(plan);
  if (normalized === "starter") return STARTER_ACCEPTED_LEADS_PER_MONTH;
  if (normalized === "growth") return GROWTH_ACCEPTED_LEADS_PER_MONTH;
  return 0;
}

export function publicTurnBudget(plan: string | null | undefined) {
  const normalized = normalizeTenantPlan(plan);
  if (normalized === "growth") return GROWTH_PUBLIC_TURNS_PER_DAY;
  if (normalized === "starter") return STARTER_PUBLIC_TURNS_PER_DAY;
  return TRIAL_PUBLIC_TURNS_PER_DAY;
}

export function widgetEnabled(plan: string | null | undefined) {
  return normalizeTenantPlan(plan) === "growth";
}

export function seatCapForPlan(plan: TenantPlan | string): number | null {
  const normalized = normalizeTenantPlan(plan);
  if (normalized === "growth") return null;
  if (normalized === "starter") return STARTER_INCLUDED_USERS;
  return TRIAL_SEAT_LIMIT;
}

export function seatAllowanceLabel(plan: string | null | undefined) {
  const cap = seatCapForPlan(plan ?? "trial");
  if (cap == null) return "Unlimited seats";
  return `${cap} seats`;
}

/** Column value. `0` means unlimited (Growth). */
export function storedSeatLimit(plan: string | null | undefined): number {
  return seatCapForPlan(plan ?? "trial") ?? 0;
}
