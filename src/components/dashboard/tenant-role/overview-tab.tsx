"use client";

import Link from "next/link";
import { NotificationFeed } from "@/components/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/useAsync";
import { getTenantUserDashboardStats } from "@/lib/supabase/queries";
import { buildTenantAdminDashboardMetrics } from "@/lib/dashboard/metrics";
import { OverviewTabSkeleton } from "@/components/dashboard/shared/skeleton";
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
    <main className="grid md:grid-cols-[320px_1fr] gap-4">
      <aside className="hidden md:block">
        <Card size="md" className="h-full">
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-[0.2em] text-accent-foreground hover:underline">
              <Link href="/notifications">Notifications</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationFeed limit={5} />
          </CardContent>
        </Card>
      </aside>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <OutstandingWorkCard className="col-span-full" />

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.cases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.recentActivity.cases} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Statements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.statements}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.recentActivity.statements} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.teamMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.pendingInvites} pending invites
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Closure Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.closureRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.closedCases} closed, {kpis.activeCases} active
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Statements per Case
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.statementsPerCase}</div>
            <p className="text-xs text-muted-foreground mt-1">
              platform-wide average
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              7 Day Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.sevenDayThroughput}</div>
            <p className="text-xs text-muted-foreground mt-1">
              cases + statements created
            </p>
          </CardContent>
        </Card>

        {stats.casesByStatus && Object.keys(stats.casesByStatus).length > 0 && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Cases by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Object.entries(stats.casesByStatus).map(([status, count]) => (
                  <div key={status} className="flex flex-col">
                    <span className="text-sm text-muted-foreground capitalize">
                      {status.replace("_", " ")}
                    </span>
                    <span className="text-2xl font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
