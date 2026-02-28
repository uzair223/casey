"use client";

import { Statement, StatementStatus } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatementDetailModal } from "./StatementDetailModal";
import { statusLabels, statusBadgeStyles } from "@/lib/statementUtils";

interface StatementCardProps {
  item: Statement;
  fetchData: () => Promise<unknown>;
}

export function StatementCard({ item, fetchData }: StatementCardProps) {
  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {item.reference}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-primary">
              {item.title}
            </h2>
            {item.claim_number && (
              <p className="mt-2 text-sm text-muted-foreground">
                Claim Number: {item.claim_number}
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Witness: {item.witness_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Incident date: {item.incident_date ?? "TBD"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {item.status && (
              <Badge
                className="uppercase"
                variant={statusBadgeStyles[item.status]}
              >
                {statusLabels[item.status]}
              </Badge>
            )}
            <StatementDetailModal id={item.id} fetchData={fetchData} />
          </div>
        </div>
      </Card>
    </>
  );
}
