import {
  campaignDestination,
  searchAdCopy,
} from "./creative";

export { campaignDestination, searchAdCopy };

export const MONTHLY_BUDGET_MIN_GBP = 30;
export const MONTHLY_BUDGET_MAX_GBP = 100_000;

export function dailyBudgetPence(monthlyGbp: number) {
  return Math.max(100, Math.round((monthlyGbp * 100) / 30));
}
