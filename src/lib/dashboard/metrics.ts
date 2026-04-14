import type { PlatformStats, TenantStats, CaseStatementJoin } from "@/types";

type DurationSummary = {
  hours: number | null;
  display: string;
};

export type TenantAdminDashboardMetrics = {
  closureRate: number;
  closedCases: number;
  activeCases: number;
  statementsPerCase: string;
  sevenDayThroughput: number;
};

export type SolicitorDashboardMetrics = {
  caseStatusCounts: Record<string, number>;
  myAssignedCases: number;
  totalCases: number;
  totalWitnessStatements: number;
  completedWitnessCount: number;
  pendingReviewCount: number;
  witnessCompletionRate: number;
  unassignedCases: number;
};

export type ParalegalDashboardMetrics = {
  assignedCases: number;
  draftCases: number;
  inProgressCases: number;
  submittedCases: number;
  lockedCases: number;
  witnessCompletionRate: number;
};

export type PlatformDashboardMetrics = {
  casesPerTenant: string;
  statementsPerTenant: string;
  usersPerTenant: string;
  statementsPerCase: string;
  sevenDayThroughput: number;
};

export type TrendDirection = "up" | "down" | "flat";

export type CountTrendSummary = {
  current: number;
  previous: number;
  delta: number;
  deltaText: string;
  direction: TrendDirection;
  comparisonLabel: string;
};

export type DurationTrendSummary = {
  current: DurationSummary;
  previous: DurationSummary;
  deltaHours: number | null;
  deltaText: string;
  direction: TrendDirection;
  comparisonLabel: string;
};

export type PlatformDashboardTrendMetrics = {
  cases7d: CountTrendSummary;
  statements7d: CountTrendSummary;
  users30d: CountTrendSummary;
  tenants30d: CountTrendSummary;
  pendingInvites30d: CountTrendSummary;
};

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function formatDurationHours(hours: number | null): string {
  if (hours == null) {
    return "N/A";
  }

  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }

  return `${(hours / 24).toFixed(1)}d`;
}

function summarizeDuration(values: number[]): DurationSummary {
  const medianHours = median(values);
  return {
    hours: medianHours,
    display: formatDurationHours(medianHours),
  };
}

function getTrendDirection(delta: number): TrendDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function formatSignedNumber(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function formatSignedHours(deltaHours: number): string {
  const absolute = Math.abs(deltaHours);
  const formatted =
    absolute < 24
      ? `${absolute.toFixed(1)}h`
      : `${(absolute / 24).toFixed(1)}d`;
  return `${deltaHours > 0 ? "+" : "-"}${formatted}`;
}

export function summarizeCountTrend(
  current: number,
  previous: number,
  comparisonLabel: string,
): CountTrendSummary {
  const delta = current - previous;
  return {
    current,
    previous,
    delta,
    deltaText: formatSignedNumber(delta),
    direction: getTrendDirection(delta),
    comparisonLabel,
  };
}

export function summarizeDurationTrend(
  current: number[],
  previous: number[],
  comparisonLabel: string,
): DurationTrendSummary {
  const currentSummary = summarizeDuration(current);
  const previousSummary = summarizeDuration(previous);
  const currentHours = currentSummary.hours;
  const previousHours = previousSummary.hours;

  if (currentHours == null || previousHours == null) {
    return {
      current: currentSummary,
      previous: previousSummary,
      deltaHours: null,
      deltaText: "N/A",
      direction: "flat",
      comparisonLabel,
    };
  }

  const deltaHours = currentHours - previousHours;
  return {
    current: currentSummary,
    previous: previousSummary,
    deltaHours,
    deltaText: formatSignedHours(deltaHours),
    direction: getTrendDirection(deltaHours),
    comparisonLabel,
  };
}

export function buildTenantAdminDashboardMetrics(
  stats: TenantStats,
): TenantAdminDashboardMetrics {
  const submittedCases = stats.casesByStatus.submitted || 0;
  const lockedCases = stats.casesByStatus.locked || 0;
  const closedCases = submittedCases + lockedCases;
  const activeCases = Math.max(stats.cases - closedCases, 0);

  return {
    closureRate:
      stats.cases > 0 ? Math.round((closedCases / stats.cases) * 100) : 0,
    closedCases,
    activeCases,
    statementsPerCase:
      stats.cases > 0 ? (stats.statements / stats.cases).toFixed(1) : "0.0",

    sevenDayThroughput:
      stats.recentActivity.cases + stats.recentActivity.statements,
  };
}

export function buildSolicitorDashboardMetrics(
  cases: CaseStatementJoin[],
  userId?: string,
): SolicitorDashboardMetrics {
  const caseStatusCounts: Record<string, number> = {};
  const witnessStatusCounts: Record<string, number> = {};

  let totalWitnessStatements = 0;
  let myAssignedCases = 0;
  let unassignedCases = 0;

  for (const caseItem of cases) {
    const caseStatus = caseItem.status || "draft";
    caseStatusCounts[caseStatus] = (caseStatusCounts[caseStatus] || 0) + 1;

    const assignedToCurrentUser =
      !!userId &&
      (caseItem.assigned_to === userId ||
        (caseItem.assigned_to_ids || []).includes(userId));

    if (assignedToCurrentUser) {
      myAssignedCases += 1;
    }

    if (
      !caseItem.assigned_to &&
      (!caseItem.assigned_to_ids || caseItem.assigned_to_ids.length === 0)
    ) {
      unassignedCases += 1;
    }

    for (const witness of caseItem.statements || []) {
      totalWitnessStatements += 1;
      const witnessStatus = witness.status || "draft";
      witnessStatusCounts[witnessStatus] =
        (witnessStatusCounts[witnessStatus] || 0) + 1;
    }
  }

  const completedWitnessCount =
    (witnessStatusCounts.submitted || 0) + (witnessStatusCounts.locked || 0);

  return {
    caseStatusCounts,
    myAssignedCases,
    totalCases: cases.length,
    totalWitnessStatements,
    completedWitnessCount,
    pendingReviewCount: witnessStatusCounts.submitted || 0,
    witnessCompletionRate:
      totalWitnessStatements > 0
        ? Math.round((completedWitnessCount / totalWitnessStatements) * 100)
        : 0,
    unassignedCases,
  };
}

export function buildParalegalDashboardMetrics(
  cases: CaseStatementJoin[],
  userId?: string,
): ParalegalDashboardMetrics {
  const assignedCases = cases.filter((caseItem) => {
    if (!userId) {
      return false;
    }

    return (
      caseItem.assigned_to === userId ||
      (caseItem.assigned_to_ids || []).includes(userId)
    );
  });

  const statusCounts = assignedCases.reduce(
    (acc, caseItem) => {
      const statusKey = caseItem.status || "draft";
      acc[statusKey] = (acc[statusKey] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalWitnessStatements = assignedCases.reduce(
    (acc, caseItem) => acc + (caseItem.statements?.length || 0),
    0,
  );

  const completedWitnessStatements = assignedCases
    .flatMap((caseItem) => caseItem.statements || [])
    .filter(
      (witness) =>
        witness.status === "submitted" ||
        witness.status === "demo_published" ||
        witness.status === "locked",
    ).length;

  return {
    assignedCases: assignedCases.length,
    draftCases: statusCounts.draft || 0,
    inProgressCases: statusCounts.in_progress || 0,
    submittedCases: statusCounts.submitted || 0,
    lockedCases: statusCounts.locked || 0,
    witnessCompletionRate:
      totalWitnessStatements > 0
        ? Math.round(
            (completedWitnessStatements / totalWitnessStatements) * 100,
          )
        : 0,
  };
}

export function buildPlatformDashboardMetrics(
  stats: PlatformStats,
): PlatformDashboardMetrics {
  return {
    casesPerTenant:
      stats.tenants > 0 ? (stats.cases / stats.tenants).toFixed(1) : "0.0",
    statementsPerTenant:
      stats.tenants > 0 ? (stats.statements / stats.tenants).toFixed(1) : "0.0",
    usersPerTenant:
      stats.tenants > 0 ? (stats.users / stats.tenants).toFixed(1) : "0.0",
    statementsPerCase:
      stats.cases > 0 ? (stats.statements / stats.cases).toFixed(1) : "0.0",
    sevenDayThroughput:
      stats.recentActivity.cases + stats.recentActivity.statements,
  };
}

export function buildPlatformDashboardTrendMetrics(input: {
  cases7dCurrent: number;
  cases7dPrevious: number;
  statements7dCurrent: number;
  statements7dPrevious: number;
  users30dCurrent: number;
  users30dPrevious: number;
  tenants30dCurrent: number;
  tenants30dPrevious: number;
  pendingInvites30dCurrent: number;
  pendingInvites30dPrevious: number;
}): PlatformDashboardTrendMetrics {
  return {
    cases7d: summarizeCountTrend(
      input.cases7dCurrent,
      input.cases7dPrevious,
      "vs previous 7 days",
    ),
    statements7d: summarizeCountTrend(
      input.statements7dCurrent,
      input.statements7dPrevious,
      "vs previous 7 days",
    ),
    users30d: summarizeCountTrend(
      input.users30dCurrent,
      input.users30dPrevious,
      "vs previous 30 days",
    ),
    tenants30d: summarizeCountTrend(
      input.tenants30dCurrent,
      input.tenants30dPrevious,
      "vs previous 30 days",
    ),
    pendingInvites30d: summarizeCountTrend(
      input.pendingInvites30dCurrent,
      input.pendingInvites30dPrevious,
      "vs previous 30 days",
    ),
  };
}
