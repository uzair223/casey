"use client";

import {
  Building2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  LayersIcon,
  MailIcon,
  UsersIcon,
} from "lucide-react";

import { useAsync } from "@/hooks/useAsync";
import { getPlatformDashboardData } from "@/lib/supabase/queries";
import { OverviewTabSkeleton } from "../shared/skeleton";
import { StatCard, StatusBreakdownCard } from "../shared/stat-card";

export function AppAdminOverviewTab() {
  const dashboard = useAsync(getPlatformDashboardData, [], {
    enabled: true,
  });

  if (!dashboard.data || dashboard.isLoading) {
    return <OverviewTabSkeleton />;
  }

  const { stats, kpis, trends } = dashboard.data;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Organisations"
        value={stats.tenants}
        hint={`${trends.tenants30d.deltaText} ${trends.tenants30d.comparisonLabel}`}
        icon={<Building2Icon className="h-4 w-4" />}
      />
      <StatCard
        label="Total Cases"
        value={stats.cases}
        hint={
          <>
            {stats.recentActivity.cases} in last 7 days
            <span className="mt-0.5 block">
              {trends.cases7d.deltaText} {trends.cases7d.comparisonLabel}
            </span>
          </>
        }
        icon={<FolderKanbanIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Statements"
        value={stats.statements}
        hint={
          <>
            {stats.recentActivity.statements} in last 7 days
            <span className="mt-0.5 block">
              {trends.statements7d.deltaText} {trends.statements7d.comparisonLabel}
            </span>
          </>
        }
        icon={<FileTextIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Users"
        value={stats.users}
        hint={
          <>
            {stats.pendingInvites} pending invites
            <span className="mt-0.5 block">
              {trends.users30d.deltaText} {trends.users30d.comparisonLabel}
            </span>
          </>
        }
        icon={<UsersIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Cases per Tenant"
        value={kpis.casesPerTenant}
        hint="platform-wide average"
        icon={<FolderKanbanIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Statements per Tenant"
        value={kpis.statementsPerTenant}
        hint="platform-wide average"
        icon={<FileTextIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Users per Tenant"
        value={kpis.usersPerTenant}
        hint="platform-wide average"
        icon={<UsersIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Statements per Case"
        value={kpis.statementsPerCase}
        hint="platform-wide average"
        icon={<LayersIcon className="h-4 w-4" />}
      />
      <StatCard
        label="Pending Invites"
        value={stats.pendingInvites}
        hint={`${trends.pendingInvites30d.deltaText} ${trends.pendingInvites30d.comparisonLabel}`}
        icon={<MailIcon className="h-4 w-4" />}
        className="lg:col-span-2"
      />

      {stats.casesByStatus && Object.keys(stats.casesByStatus).length > 0 ? (
        <StatusBreakdownCard
          className="col-span-full"
          title="Cases by Status"
          items={Object.entries(stats.casesByStatus).map(([status, count]) => [
            status,
            String(count),
          ])}
        />
      ) : null}
    </div>
  );
}
