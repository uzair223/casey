"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusLabels, statusBadgeStyles } from "@/lib/statementUtils";
import { Statement } from "@/lib/types";

interface RecentCasesListProps {
  cases: Statement[];
  isLoading: boolean;
  maxItems?: number;
}

export function RecentCasesList({
  cases,
  isLoading,
  maxItems = 5,
}: RecentCasesListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent cases</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading cases...</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cases yet.</p>
        ) : (
          cases.slice(0, maxItems).map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {item.reference}
                </p>
                <p className="text-sm font-semibold text-primary">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Witness: {item.witness_name}
                </p>
              </div>
              {item.status && (
                <Badge
                  className="uppercase"
                  variant={statusBadgeStyles[item.status]}
                >
                  {statusLabels[item.status]}
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
