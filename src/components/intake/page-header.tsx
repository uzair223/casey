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
    <div className="shrink-0 flex items-end justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent-foreground">
          {tenant_name} Witness intake
        </p>
        <h1 className="text-2xl font-semibold text-primary font-display">
          {statement.title}
        </h1>
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
