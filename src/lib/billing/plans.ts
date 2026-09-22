export const FREE_CASE_LIMIT = 3;

export const PRACTICE_PRICE_GBP = 149;
export const PRACTICE_SEAT_LIMIT = 5;
export const PRACTICE_CASES_PER_MONTH = 30;

export const FIRM_SEAT_PRICE_GBP = 49;
export const FIRM_MIN_SEATS = 6;
export const FIRM_CASES_PER_SEAT = 8;

export const EXTRA_CASE_PRICE_GBP = 12;

export type TenantPlan = "trial" | "practice" | "firm";
export type CaseGate = "practice" | "firm" | "extra_case";

export function isTenantPlan(value: string | null | undefined): value is TenantPlan {
  return value === "trial" || value === "practice" || value === "firm";
}

export function isCaseGate(value: string | null | undefined): value is CaseGate {
  return value === "practice" || value === "firm" || value === "extra_case";
}

export function monthlyCaseAllowance(plan: TenantPlan, seatLimit: number) {
  if (plan === "practice") return PRACTICE_CASES_PER_MONTH;
  if (plan === "firm") return Math.max(0, seatLimit) * FIRM_CASES_PER_SEAT;
  return 0;
}

export function seatCapForPlan(plan: TenantPlan, seatLimit: number) {
  if (plan === "firm") return seatLimit;
  return PRACTICE_SEAT_LIMIT;
}
