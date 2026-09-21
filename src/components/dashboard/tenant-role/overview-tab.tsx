"use client";

import Link from "next/link";
import {
  ActivityIcon,
  BellIcon,
  BriefcaseIcon,
  FileTextIcon,
  LayersIcon,
  PercentIcon,
  UsersIcon,
} from "lucide-react";

import { NotificationFeed } from "@/components/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/useAsync";
import { getTenantUserDashboardStats } from "@/lib/supabase/queries";
import { buildTenantAdminDashboardMetrics } from "@/lib/dashboard/metrics";
import { OverviewTabSkeleton } from "@/components/dashboard/shared/skeleton";
import {
  StatCard,
  StatusBreakdownCard,
} from "@/components/dashboard/shared/stat-card";
import { OutstandingWorkCard } from "./outstanding-work-card";

export function TenantRoleOverviewTab() {
  const { data: stats, isLoading } = useAsync(
    () => getTenantUserDashboardStats(),
    [],
    { enabled: true },
  );

  if (isLoading || !stats) {
    return <OverviewTabSkeleton />;
  }

  const kpis = buildTenantAdminDashboardMetrics(stats);

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="hidden md:block">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-[0.2em] text-accent-foreground hover:underline">
              <Link href="/notifications" className="inline-flex items-center gap-2">
                <BellIcon className="h-3.5 w-3.5" />
                Notifications
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationFeed limit={5} />
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <OutstandingWorkCard className="col-span-full" />

        <StatCard
          label="Cases"
          value={stats.cases}
          hint={`${stats.recentActivity.cases} in last 7 days`}
          icon={<BriefcaseIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Statements"
          value={stats.statements}
          hint={`${stats.recentActivity.statements} in last 7 days`}
          icon={<FileTextIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Team Members"
          value={stats.teamMembers}
          hint={`${stats.pendingInvites} pending invites`}
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Closure Rate"
          value={`${kpis.closureRate}%`}
          hint={`${kpis.closedCases} closed, ${kpis.activeCases} active`}
          icon={<PercentIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Statements per Case"
          value={kpis.statementsPerCase}
          hint="platform-wide average"
          icon={<LayersIcon className="h-4 w-4" />}
        />
        <StatCard
          label="7 Day Throughput"
          value={kpis.sevenDayThroughput}
          hint="cases + statements created"
          icon={<ActivityIcon className="h-4 w-4" />}
        />

        {stats.casesByStatus && Object.keys(stats.casesByStatus).length > 0 ? (
          <StatusBreakdownCard
            className="col-span-full"
            title="Cases by Status"
            items={Object.entries(stats.casesByStatus)}
          />
        ) : null}
      </div>
    </div>
  );
}
