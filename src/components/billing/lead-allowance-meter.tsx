"use client";

import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsTenantAdmin } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { startPlanCheckout } from "@/lib/billing/client";
import { EXTRA_LEAD_PRICE_GBP } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type LeadUsageSummary = {
  plan: "trial" | "starter" | "growth";
  billingStatus: string;
  mode: "free" | "monthly" | "needs_plan";
  used: number;
  limit: number;
  overageCredits: number;
  canPurchaseOverage: boolean;
  periodStart: string | null;
};

type LeadAllowanceMeterProps = {
  className?: string;
  /** Wrap in a card for dashboard surfaces. */
  asCard?: boolean;
};

function usageCopy(usage: LeadUsageSummary) {
  if (usage.mode === "monthly") {
    return {
      title: "Accepted leads this period",
      detail: `${usage.used} of ${usage.limit} included`,
    };
  }
  if (usage.mode === "free") {
    return {
      title: "Free accepted leads",
      detail: `${usage.used} of ${usage.limit} used`,
    };
  }
  return {
    title: "Accepted leads",
    detail: `Free allowance used (${usage.limit}). Choose a plan to accept more.`,
  };
}

function MeterBody({
  usage,
  canCheckout,
}: {
  usage: LeadUsageSummary;
  canCheckout: boolean;
}) {
  const copy = usageCopy(usage);
  const ratio =
    usage.limit > 0 ? Math.min(1, usage.used / usage.limit) : 0;
  const exhausted = usage.used >= usage.limit;
  const showPurchase = usage.canPurchaseOverage && canCheckout;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-sm text-muted-foreground">{copy.detail}</p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={Math.min(usage.used, usage.limit)}
        aria-label={copy.title}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            exhausted ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {usage.overageCredits > 0
            ? `${usage.overageCredits} additional lead${usage.overageCredits === 1 ? "" : "s"} ready to use.`
            : usage.mode === "monthly"
              ? exhausted
                ? "Included leads are used for this period."
                : "Accepted leads count against this month's allowance."
              : usage.mode === "free"
                ? "The first accepted leads are included before a plan."
                : "Starter or Growth unlocks a monthly accepted-lead allowance."}
        </p>
        {showPurchase ? (
          <AsyncButton
            type="button"
            variant="outline"
            size="sm"
            pendingText="Opening Stripe..."
            onClick={() => startPlanCheckout({ kind: "extra_lead" })}
          >
            Buy additional leads · £{EXTRA_LEAD_PRICE_GBP}
          </AsyncButton>
        ) : null}
      </div>
    </div>
  );
}

export function LeadAllowanceMeter({
  className,
  asCard = false,
}: LeadAllowanceMeterProps) {
  const canCheckout = useIsTenantAdmin();
  const { data: usage, isLoading } = useAsync(
    () => apiFetch<LeadUsageSummary>("/api/tenant/billing/usage"),
    [],
    { enabled: true },
  );

  if (isLoading || !usage) {
    if (asCard) {
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle>Lead allowance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Loading usage…</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-sm text-muted-foreground">Loading usage…</p>
      </div>
    );
  }

  if (asCard) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Lead allowance</CardTitle>
        </CardHeader>
        <CardContent>
          <MeterBody usage={usage} canCheckout={canCheckout} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <MeterBody usage={usage} canCheckout={canCheckout} />
    </div>
  );
}
