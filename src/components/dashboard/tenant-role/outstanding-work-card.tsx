"use client";

import { useAsync } from "@/hooks/useAsync";
import { getOutstandingWorkSummary } from "@/lib/supabase/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/dashboard/shared/skeleton";

export function OutstandingWorkCard(props: React.ComponentProps<typeof Card>) {
  const { data: outstanding, isLoading } = useAsync(
    async () =>
      getOutstandingWorkSummary({
        staleDays: 7,
        limit: 10,
      }),
    [],
  );

  if (isLoading || !outstanding) {
    return <CardSkeleton title="Outstanding work" {...props} />;
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Outstanding work</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Waiting on witness</p>
            <p className="mt-1 text-2xl font-bold">
              {outstanding.waitingOnWitnessCount}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Waiting on review</p>
            <p className="mt-1 text-2xl font-bold">
              {outstanding.waitingOnReviewCount}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Overdue reminders</p>
            <p className="mt-1 text-2xl font-bold">
              {outstanding.overdueReminderCount}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Stale cases</p>
            <p className="mt-1 text-2xl font-bold">
              {outstanding.staleCaseCount}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">Waiting on witness</p>
            <div className="mt-2 space-y-2">
              {outstanding.waitingOnWitness.length ? (
                outstanding.waitingOnWitness.map((item) => (
                  <div
                    key={item.statementId}
                    className="text-xs text-muted-foreground"
                  >
                    {item.caseTitle} • {item.witnessName} • {item.status}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No items</p>
              )}
            </div>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">Waiting on review</p>
            <div className="mt-2 space-y-2">
              {outstanding.waitingOnReview.length ? (
                outstanding.waitingOnReview.map((item) => (
                  <div
                    key={item.statementId}
                    className="text-xs text-muted-foreground"
                  >
                    {item.caseTitle} • {item.witnessName}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No items</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
