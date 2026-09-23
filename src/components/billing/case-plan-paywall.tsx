"use client";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { startPlanCheckout } from "@/lib/billing/client";
import {
  EXTRA_LEAD_PRICE_GBP,
  GROWTH_PRICE_GBP,
  STARTER_PRICE_GBP,
  type CaseGate,
} from "@/lib/billing/plans";

type CasePlanPaywallProps = {
  gate: CaseGate;
  canCheckout: boolean;
  onClose: () => unknown;
};

export function CasePlanPaywall({
  gate,
  canCheckout,
  onClose,
}: CasePlanPaywallProps) {
  const needsPlan = gate !== "extra_case" && gate !== "extra_lead";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {needsPlan ? "Choose a plan" : "This month's leads are used"}
        </p>
        <p className="text-sm text-muted-foreground">
          {needsPlan
            ? "The first three accepted leads are included. The next one needs a plan."
            : `£${EXTRA_LEAD_PRICE_GBP} accepts another lead.`}
        </p>
      </div>

      {canCheckout ? (
        <div className="space-y-3">
          {needsPlan ? (
            <>
              <AsyncButton
                onClick={() => startPlanCheckout({ kind: "starter" })}
                pendingText="Opening Stripe..."
              >
                Starter · £{STARTER_PRICE_GBP} a month
              </AsyncButton>
              <AsyncButton
                variant="outline"
                onClick={() => startPlanCheckout({ kind: "growth" })}
                pendingText="Opening Stripe..."
              >
                Growth · £{GROWTH_PRICE_GBP} a month
              </AsyncButton>
            </>
          ) : (
            <AsyncButton
              onClick={() => startPlanCheckout({ kind: "extra_lead" })}
              pendingText="Opening Stripe..."
            >
              £{EXTRA_LEAD_PRICE_GBP} for this lead
            </AsyncButton>
          )}
          <p className="text-xs text-muted-foreground">
            Starter includes the hosted page and email outreach. Growth adds
            the website widget, branding, and text messages. The addendum is
            accepted before payment.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          A firm admin chooses the plan for the next lead.
        </p>
      )}

      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
