"use client";

import Link from "next/link";
import { NotificationFeed } from "@/components/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/contexts/tenant-context";
import { buildParalegalDashboardMetrics } from "@/lib/dashboard/metrics";
import { OverviewTabSkeleton } from "@/components/dashboard/shared/skeleton";
import { useUser } from "@/contexts/user-context";

export function ParalegalOverviewTab() {
  const { user } = useUser();
  const { cases } = useTenant();

  if (cases.isLoading) {
    return <OverviewTabSkeleton />;
  }

  const metrics = buildParalegalDashboardMetrics(cases.data, user!.id);

  return (
    <main className="grid grid-cols-[320px_1fr] gap-4">
      <aside>
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
        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.assignedCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              cases assigned to you
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.draftCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              assigned cases in draft
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.inProgressCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              assigned cases in progress
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Submitted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.submittedCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ready for review
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Locked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.lockedCases}</div>
            <p className="text-xs text-muted-foreground mt-1">
              locked case files
            </p>
          </CardContent>
        </Card>

        <Card size="md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Witness Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics.witnessCompletionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              witness statements completed
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
