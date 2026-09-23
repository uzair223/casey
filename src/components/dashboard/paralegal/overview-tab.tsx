"use client";

import Link from "next/link";
import {
  BellIcon,
  BriefcaseIcon,
  FilePenLineIcon,
  LockIcon,
  PercentIcon,
  SendIcon,
  TimerIcon,
} from "@/components/icons";

import { NotificationFeed } from "@/components/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/contexts/tenant-context";
import { buildParalegalDashboardMetrics } from "@/lib/dashboard/metrics";
import { OverviewTabSkeleton } from "@/components/dashboard/shared/skeleton";
import { StatCard } from "@/components/dashboard/shared/stat-card";
import { useUser } from "@/contexts/user-context";

export function ParalegalOverviewTab() {
  const { user } = useUser();
  const { cases } = useTenant();

  if (cases.isLoading) {
    return <OverviewTabSkeleton />;
  }

  const metrics = buildParalegalDashboardMetrics(cases.data, user!.id);

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
        <StatCard
          label="Assigned leads"
          value={metrics.assignedCases}
          hint="leads assigned to you"
          icon={<BriefcaseIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Draft"
          value={metrics.draftCases}
          hint="assigned leads in draft"
          icon={<FilePenLineIcon className="h-4 w-4" />}
        />
        <StatCard
          label="In Progress"
          value={metrics.inProgressCases}
          hint="assigned leads in progress"
          icon={<TimerIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Submitted"
          value={metrics.submittedCases}
          hint="ready for review"
          icon={<SendIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Locked"
          value={metrics.lockedCases}
          hint="locked case files"
          icon={<LockIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Witness Completion"
          value={`${metrics.witnessCompletionRate}%`}
          hint="witness statements completed"
          icon={<PercentIcon className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
