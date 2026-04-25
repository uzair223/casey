"use client";

import { useWitnessStatement } from "@/components/intake/intake-context";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function PageHeader() {
  const {
    data: { tenant_name, statement },
    isDemo,
  } = useWitnessStatement();

  return (
    <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground sm:text-sm">
          {tenant_name} Witness intake
        </p>
        <h1 className="text-xl leading-tight font-semibold text-primary font-display sm:text-2xl">
          {statement.title}
        </h1>
      </div>
      {isDemo && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
