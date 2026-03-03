"use client";

import { Statement } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatementDetailModal } from "./StatementDetailModal";
import { statusLabels, statusBadgeStyles } from "@/lib/statementUtils";

interface StatementCardProps {
  item: Statement;
  fetchData: () => Promise<unknown>;
  assigneeLabelMap?: Record<string, string>;
}

export function StatementCard({
  item,
  fetchData,
  assigneeLabelMap,
}: StatementCardProps) {
  const assigneeIds = Array.from(
    new Set([
      ...(item.assigned_to_ids || []),
      ...(item.assigned_to ? [item.assigned_to] : []),
    ]),
  );

  const assigneeLabels = assigneeIds.map(
    (id) => assigneeLabelMap?.[id] || "Team member",
  );

  const assignedSummary =
    assigneeLabels.length === 0
      ? "Unassigned"
      : assigneeLabels.length <= 2
        ? assigneeLabels.join(", ")
        : `${assigneeLabels.slice(0, 2).join(", ")} +${assigneeLabels.length - 2} more`;

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
            <p className="text-sm text-muted-foreground">
              Assigned: {assignedSummary}
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
