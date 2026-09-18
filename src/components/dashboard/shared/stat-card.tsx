import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight text-primary">
          {value}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function StatusBreakdownCard({
  title,
  items,
  className,
}: {
  title: string;
  items: [string, number | string][];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map(([status, count]) => (
            <div key={status} className="flex flex-col">
              <span className="text-sm capitalize text-muted-foreground">
                {status.replace("_", " ")}
              </span>
              <span className="mt-1 text-2xl font-bold text-primary">
                {count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
