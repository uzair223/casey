"use client";

import { useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startPlanCheckout } from "@/lib/billing/client";
import {
  EXTRA_CASE_PRICE_GBP,
  FIRM_MIN_SEATS,
  FIRM_SEAT_PRICE_GBP,
  PRACTICE_PRICE_GBP,
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
  const [seats, setSeats] = useState(String(FIRM_MIN_SEATS));
  const needsPlan = gate !== "extra_case";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {needsPlan ? "Choose a plan" : "This month's cases are used"}
        </p>
        <p className="text-sm text-muted-foreground">
          {needsPlan
            ? "The first three cases are included. The next one needs a plan."
            : `£${EXTRA_CASE_PRICE_GBP} opens another case.`}
        </p>
      </div>

      {canCheckout ? (
        <div className="space-y-3">
          {needsPlan ? (
            <>
              <AsyncButton
                onClick={() => startPlanCheckout({ kind: "practice" })}
                pendingText="Opening Stripe..."
              >
                Practice · £{PRACTICE_PRICE_GBP} a month
              </AsyncButton>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="firm-seats">Firm seats</Label>
                  <Input
                    id="firm-seats"
                    type="number"
                    min={FIRM_MIN_SEATS}
                    value={seats}
                    onChange={(event) => setSeats(event.target.value)}
                    className="w-24"
                  />
                </div>
                <AsyncButton
                  variant="outline"
                  onClick={() =>
                    startPlanCheckout({
                      kind: "firm",
                      seats: Number(seats),
                    })
                  }
                  pendingText="Opening Stripe..."
                >
                  Firm · £{FIRM_SEAT_PRICE_GBP} a seat
                </AsyncButton>
              </div>
            </>
          ) : (
            <AsyncButton
              onClick={() => startPlanCheckout({ kind: "extra_case" })}
              pendingText="Opening Stripe..."
            >
              £{EXTRA_CASE_PRICE_GBP} for this case
            </AsyncButton>
          )}
          <p className="text-xs text-muted-foreground">
            Five people and thirty cases on Practice. Firm starts at{" "}
            {FIRM_MIN_SEATS} people, with eight cases a seat. The addendum is
            accepted before payment.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          A firm admin chooses the plan for the next case.
        </p>
      )}

      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
