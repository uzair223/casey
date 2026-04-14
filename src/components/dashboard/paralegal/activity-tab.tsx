"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/contexts/tenant-context";
import { CardSkeleton } from "@/components/dashboard/shared/skeleton";
import { useUser } from "@/contexts/user-context";

export function ParalegalActivityTab() {
  const { user } = useUser();
  const { cases } = useTenant();

  if (cases.isLoading) {
    return <CardSkeleton title="Recent Activity" />;
  }

  const recentAssignedCases = cases.data
    .filter(
      (caseItem) =>
        caseItem.assigned_to === user!.id ||
        (caseItem.assigned_to_ids || []).includes(user!.id),
    )
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() -
        new Date(left.updated_at).getTime(),
    )
    .slice(0, 10);

  return (
    <Card size="md">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {recentAssignedCases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent assigned-case activity yet.
          </p>
        ) : (
          <div className="space-y-3">
            {recentAssignedCases.map((caseItem) => (
              <div key={caseItem.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{caseItem.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(caseItem.updated_at).toLocaleString()}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  Status: {(caseItem.status || "draft").replace("_", " ")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {caseItem.statements.length} witness statement(s)
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
