"use client";

import { useStatement } from "@/contexts/StatementContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function PageHeader() {
  const { statementData, isDemo } = useStatement();

  if (!statementData) return null;
  return (
    <div className="shrink-0 flex items-end justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          {statementData.title
            ? `${statementData.tenant_name} Witness intake`
            : "Witness intake"}
        </p>
        <h1 className="text-2xl font-semibold text-primary font-display">
          {statementData.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Case reference: {statementData.reference}
        </p>
      </div>
      {isDemo && (
        <div className="inline-flex items-center gap-2">
          <Button className="pl-1 gap-1" variant="ghost" size="sm" asChild>
            <Link href="/">
              <ChevronLeft />
              <span>Back</span>
            </Link>
          </Button>
          <Badge>DEMO</Badge>
        </div>
      )}
    </div>
  );
}
