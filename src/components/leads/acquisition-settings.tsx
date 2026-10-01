"use client";

import { useEffect, useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import type { AcquisitionBoard } from "@/lib/leads/acquisition/types";
import { toast } from "@/lib/toast";

export function useAcquisitionBoard() {
  return useAsync(
    () => apiFetch<AcquisitionBoard>("/api/tenant/acquisition"),
    [],
    { withUseEffect: true, initialState: null },
  );
}

export function leadSourceText(
  board: AcquisitionBoard | null,
  statements: Array<{ id: string; participant_kind?: string | null }>,
) {
  const primary = statements.find((statement) => statement.participant_kind === "primary");
  const source = primary ? board?.sources[primary.id] : undefined;
  if (!source) return "—";
  return source.spend ? `${source.label} · ${source.spend}` : source.label;
}

async function openConnection(path: string) {
  const payload = await apiFetch<{ url: string }>(path);
  window.location.href = payload.url;
}

export function AcquisitionSettings() {
  const board = useAcquisitionBoard();
  const [webhook, setWebhook] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const webhookValue = webhook ?? board.data?.webhookUrl ?? "";
  const regionValue = region ?? board.data?.clioRegion ?? "eu";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const connected = params.get("connected");
    if (!error && connected !== "clio") return;
    if (error) toast.error(error);
    if (connected === "clio") toast.success("Clio connected");
    window.history.replaceState(null, "", "/settings/intake");
  }, []);

  if (board.isLoading) return null;
  if (!board.data) {
    return (
      <p className="text-sm text-muted-foreground">
        {board.error?.message || "The handoff could not load."}
      </p>
    );
  }
  const data = board.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>After a lead is accepted</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Casey keeps the lead. It can also send the contact, the enquiry summary, and the source to Clio or to another system.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="clio-region">Clio region</Label>
            <select
              id="clio-region"
              className="rounded-md border bg-background px-2 py-2 text-sm"
              value={regionValue}
              onChange={(event) => setRegion(event.target.value)}
            >
              <option value="eu">Europe</option>
              <option value="us">United States</option>
              <option value="ca">Canada</option>
              <option value="au">Australia</option>
            </select>
          </div>
          <AsyncButton
            variant="outline"
            disabled={!data.clioConfigured}
            onClick={() => openConnection(`/api/tenant/acquisition/clio/start?region=${regionValue}`)}
            pendingText="Opening Clio..."
          >
            {data.clioConnected ? "Reconnect Clio" : "Connect Clio"}
          </AsyncButton>
          {data.clioConnected ? (
            <AsyncButton
              variant="outline"
              onClick={async () => {
                board.setData(
                  await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/clio", { method: "DELETE" }),
                );
              }}
              pendingText="Removing..."
            >
              Disconnect Clio
            </AsyncButton>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Webhook</Label>
          <div className="flex gap-2">
            <Input
              id="webhook-url"
              value={webhookValue}
              placeholder="https://"
              onChange={(event) => setWebhook(event.target.value)}
            />
            <AsyncButton
              variant="outline"
              onClick={async () => {
                board.setData(
                  await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/webhook", {
                    method: "POST",
                    body: JSON.stringify({ url: webhookValue }),
                  }),
                );
                toast.success("Webhook saved");
              }}
              pendingText="Saving..."
            >
              Save
            </AsyncButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
