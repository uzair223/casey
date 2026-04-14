"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/useAsync";
import { getPlatformDashboardData } from "@/lib/supabase/queries";
import { OverviewTabSkeleton } from "../shared/skeleton";

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
      <Card size="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tenants
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.tenants}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {trends.tenants30d.deltaText} {trends.tenants30d.comparisonLabel}
          </p>
        </CardContent>
      </Card>

      <Card size="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.cases}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.recentActivity.cases} in last 7 days
          </p>
          <p className="text-xs text-muted-foreground">
            {trends.cases7d.deltaText} {trends.cases7d.comparisonLabel}
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
          <p className="text-xs text-muted-foreground">
            {trends.statements7d.deltaText}{" "}
            {trends.statements7d.comparisonLabel}
          </p>
        </CardContent>
      </Card>

      <Card size="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.users}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.pendingInvites} pending invites
          </p>
          <p className="text-xs text-muted-foreground">
            {trends.users30d.deltaText} {trends.users30d.comparisonLabel}
          </p>
        </CardContent>
      </Card>

      <Card size="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cases per Tenant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{kpis.casesPerTenant}</div>
          <p className="text-xs text-muted-foreground mt-1">
            platform-wide average
          </p>
        </CardContent>
      </Card>

      <Card size="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Statements per Tenant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{kpis.statementsPerTenant}</div>
          <p className="text-xs text-muted-foreground mt-1">
            platform-wide average
          </p>
        </CardContent>
      </Card>

      <Card size="md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Users per Tenant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{kpis.usersPerTenant}</div>
          <p className="text-xs text-muted-foreground mt-1">
            platform-wide average
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
            Pending Invites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.pendingInvites}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {trends.pendingInvites30d.deltaText}{" "}
            {trends.pendingInvites30d.comparisonLabel}
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
                  <span className="text-2xl font-bold">{String(count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
