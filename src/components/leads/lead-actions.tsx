"use client";

import { useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiRequestError } from "@/lib/api-utils";
import { CasePlanPaywall } from "@/components/billing/case-plan-paywall";
import type { CaseGate } from "@/lib/billing/plans";
import { GENERIC_DECLINE_REASONS, type DeclineReason } from "@/lib/leads/schema";
import { toast } from "@/lib/toast";

type LeadStatement = {
  id: string;
  participant_kind?: string | null;
  role_key?: string | null;
  lead_stage?: string | null;
  outreach_confirmed_at?: string | null;
  witness_name?: string | null;
  status?: string | null;
};

export function LeadActions({
  statements,
  declineReasons = [],
  onChanged,
}: {
  statements: LeadStatement[];
  declineReasons?: DeclineReason[];
  onChanged: () => Promise<unknown> | unknown;
}) {
  const [gate, setGate] = useState<CaseGate | null>(null);
  const [declineReason, setDeclineReason] = useState("other");
  const primary =
    statements.find((statement) => statement.participant_kind === "primary") ??
    null;
  const supporting = statements.filter(
    (statement) => statement.participant_kind === "supporting",
  );

  async function decide(action: "accept" | "decline") {
    if (!primary) return;
    try {
      await apiFetch(`/api/tenant/leads/${primary.id}/decision`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason: action === "decline" ? declineReason : undefined,
        }),
      });
      toast.success(action === "accept" ? "Lead accepted" : "Lead declined");
      await onChanged();
    } catch (error) {
      if (error instanceof ApiRequestError && error.gate) {
        setGate(error.gate);
        return;
      }
      throw error;
    }
  }

  return (
    <div className="space-y-3">
      {primary?.lead_stage ? (
        <p className="text-sm text-muted-foreground">
          Lead stage: {primary.lead_stage.replaceAll("_", " ")}
          {primary.role_key ? ` · ${primary.role_key}` : ""}
        </p>
      ) : null}
      {gate ? (
        <CasePlanPaywall gate={gate} canCheckout onClose={() => setGate(null)} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {primary && (primary.lead_stage === "new" || primary.lead_stage === "declined") ? (
          <>
            <AsyncButton onClick={() => decide("accept")} pendingText="Accepting...">
              Accept lead
            </AsyncButton>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Reason</span>
              <select
                className="rounded-md border bg-background px-2 py-1"
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
              >
                {[...GENERIC_DECLINE_REASONS, ...declineReasons].map((reason) => (
                  <option key={reason.key} value={reason.key}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <AsyncButton
              variant="outline"
              onClick={() => decide("decline")}
              pendingText="Declining..."
            >
              Decline
            </AsyncButton>
          </>
        ) : null}
        {statements
          .filter((statement) => statement.status === "submitted")
          .map((statement) => (
          <AsyncButton
            key={`draft-${statement.id}`}
            variant="outline"
            pendingText="Drafting..."
            onClick={async () => {
              await apiFetch(`/api/tenant/statement/${statement.id}/formalize`, {
                method: "POST",
              });
              toast.success("Draft started");
              await onChanged();
            }}
          >
            Draft {statement.witness_name || "account"}
          </AsyncButton>
        ))}
        {supporting
          .filter((statement) => !statement.outreach_confirmed_at)
          .map((statement) => (
            <Button
              key={`ask-${statement.id}`}
              variant="outline"
              onClick={async () => {
                await apiFetch(
                  `/api/tenant/statement/${statement.id}/request-account`,
                  { method: "POST" },
                );
                toast.success("Account requested");
                await onChanged();
              }}
            >
              Ask {statement.witness_name || "them"}
            </Button>
          ))}
      </div>
    </div>
  );
}
