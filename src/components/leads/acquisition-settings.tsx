"use client";

import { useEffect, useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import type { AcquisitionBoard, AcquisitionPreview } from "@/lib/leads/acquisition/types";
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

export function AcquisitionSettings({ handoff = true }: { handoff?: boolean }) {
  const board = useAcquisitionBoard();
  const [budget, setBudget] = useState<string | null>(null);
  const [places, setPlaces] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [preview, setPreview] = useState<AcquisitionPreview | null>(null);
  const [webhook, setWebhook] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const savedBudget = board.data?.campaigns.find((campaign) => campaign.monthlyBudgetGbp)
    ?.monthlyBudgetGbp;
  const budgetValue = budget ?? (savedBudget ? String(savedBudget) : "300");
  const placesValue = places ?? (board.data?.places ?? []).join("\n");
  const websiteValue = website ?? board.data?.website?.url ?? "";
  const webhookValue = webhook ?? board.data?.webhookUrl ?? "";
  const regionValue = region ?? board.data?.clioRegion ?? "eu";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const connected = params.get("connected");
    if (!error && !connected) return;
    if (error) toast.error(error);
    if (connected === "google") toast.success("Google Ads connected");
    if (connected === "meta") toast.success("Meta connected");
    if (connected === "clio") toast.success("Clio connected");
    window.history.replaceState(null, "", "/settings/intake");
  }, []);

  if (board.isLoading) return null;
  if (!board.data) {
    return (
      <p className="text-sm text-muted-foreground">
        {board.error?.message || "Ads and the handoff could not load."}
      </p>
    );
  }
  const data = board.data;

  async function saveCampaign(action: "run" | "pause" | "resume") {
    const next = await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/campaigns", {
      method: "POST",
      body: JSON.stringify({
        action,
        monthlyBudgetGbp: Number(budgetValue),
        places: placesValue,
      }),
    });
    board.setData(next);
    setPlaces(null);
    toast.success(action === "pause" ? "Campaigns paused" : "Campaigns updated");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Ads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.growth ? (
            <>
              <p className="text-sm text-muted-foreground">
                Connect the firm&apos;s own Google Ads or Meta account. Casey uses one tracking link into the same enquiry chat.
              </p>
              {data.trackingUrl ? (
                <div className="space-y-2">
                  <Label>Tracking link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={data.trackingUrl} />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(data.trackingUrl ?? "");
                        toast.success("Tracking link copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set the public address before Casey can give you a tracking link.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <AsyncButton
                  variant="outline"
                  disabled={!data.googleConfigured}
                  onClick={() => openConnection("/api/tenant/acquisition/google/start")}
                  pendingText="Opening Google..."
                >
                  {data.googleConnected ? "Reconnect Google Ads" : "Connect Google Ads"}
                </AsyncButton>
                {data.googleConnected ? (
                  <AsyncButton
                    variant="outline"
                    onClick={async () => {
                      board.setData(
                        await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/google", {
                          method: "DELETE",
                        }),
                      );
                    }}
                    pendingText="Removing..."
                  >
                    Disconnect Google Ads
                  </AsyncButton>
                ) : null}
                <AsyncButton
                  variant="outline"
                  disabled={!data.metaConfigured}
                  onClick={() => openConnection("/api/tenant/acquisition/meta/start")}
                  pendingText="Opening Meta..."
                >
                  {data.metaConnected ? "Reconnect Meta" : "Connect Meta"}
                </AsyncButton>
                {data.metaConnected ? (
                  <AsyncButton
                    variant="outline"
                    onClick={async () => {
                      board.setData(
                        await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/meta", {
                          method: "DELETE",
                        }),
                      );
                    }}
                    pendingText="Removing..."
                  >
                    Disconnect Meta
                  </AsyncButton>
                ) : null}
              </div>
              {!data.googleConfigured || !data.metaConfigured ? (
                <p className="text-sm text-muted-foreground">
                  A connection stays off until that provider is configured on this Casey workspace.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="firm-website">Firm website</Label>
                <div className="flex gap-2">
                  <Input
                    id="firm-website"
                    value={websiteValue}
                    placeholder="https://"
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                  <AsyncButton
                    variant="outline"
                    onClick={async () => {
                      const next = await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/site", {
                        method: "POST",
                        body: JSON.stringify({ url: websiteValue }),
                      });
                      board.setData(next);
                      setWebsite(null);
                      toast.success("Website read");
                    }}
                    pendingText="Reading..."
                  >
                    Read website
                  </AsyncButton>
                </div>
                {data.website?.summary ? (
                  <p className="text-sm text-muted-foreground">{data.website.summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Casey reads the public page and uses the firm&apos;s own description in the ads.
                  </p>
                )}
                {data.website?.claims.length ? (
                  <p className="text-sm text-muted-foreground">
                    The site talks about {data.website.claims.join(", ")}. Turn those lead types on if they should be advertised.
                  </p>
                ) : null}
                {data.website?.places.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Places named on the site: {data.website.places.join(", ")}.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPlaces(data.website?.places.join("\n") ?? "")}
                    >
                      Use these places
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-images">Images</Label>
                <Input
                  id="ad-images"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    try {
                      const body = new FormData();
                      body.append("file", file);
                      board.setData(
                        await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/assets", {
                          method: "POST",
                          body,
                        }),
                      );
                      toast.success("Image added");
                    } catch (error) {
                      toast.errorFromUnknown(error, "The image was not added.");
                    }
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Upload up to 6 PNG or JPEG images. Casey uses them on the ads, and draws a brand card when none are uploaded.
                </p>
                {data.assets.length ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {data.assets.map((asset) => (
                      <AssetThumb
                        key={asset.id}
                        id={asset.id}
                        name={asset.name}
                        onRemove={async () => {
                          board.setData(
                            await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/assets", {
                              method: "DELETE",
                              body: JSON.stringify({ id: asset.id }),
                            }),
                          );
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ad-places">Where should the ads run?</Label>
                <Textarea
                  id="ad-places"
                  value={placesValue}
                  placeholder="Manchester, Leeds"
                  onChange={(event) => setPlaces(event.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Casey writes one ad for each turned-on lead type, in the firm&apos;s colours, and aims them at these places. With no places listed, the ads cover the UK.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthly-budget">Monthly budget (£)</Label>
                <Input
                  id="monthly-budget"
                  inputMode="numeric"
                  value={budgetValue}
                  onChange={(event) => setBudget(event.target.value.replace(/[^\d]/g, ""))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <AsyncButton
                  variant="outline"
                  onClick={async () => {
                    setPreview(
                      await apiFetch<AcquisitionPreview>("/api/tenant/acquisition/preview", {
                        method: "POST",
                        body: JSON.stringify({ places: placesValue }),
                      }),
                    );
                  }}
                  pendingText="Drawing ads..."
                >
                  Preview ads
                </AsyncButton>
                <AsyncButton onClick={() => saveCampaign("run")} pendingText="Starting...">
                  Run campaigns
                </AsyncButton>
                <AsyncButton variant="outline" onClick={() => saveCampaign("pause")} pendingText="Pausing...">
                  Pause
                </AsyncButton>
                <AsyncButton variant="outline" onClick={() => saveCampaign("resume")} pendingText="Resuming...">
                  Resume
                </AsyncButton>
                <AsyncButton
                  variant="outline"
                  onClick={async () => {
                    const next = await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/spend", {
                      method: "POST",
                    });
                    board.setData(next);
                    toast.success("Spend updated");
                  }}
                  pendingText="Updating spend..."
                >
                  Update spend
                </AsyncButton>
              </div>
              {data.campaigns.length ? (
                <ul className="space-y-2 text-sm">
                  {data.campaigns.map((campaign) => (
                    <li key={campaign.provider}>
                      {campaign.provider === "google" ? "Google search" : "Meta"}: {campaign.status}
                      {campaign.spend ? ` · ${campaign.spend} spent` : ""}
                      {campaign.error ? ` · ${campaign.error}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {preview?.ads.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.assets.length ? (
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      These cards are the words. Google and Meta use the images uploaded above.
                    </p>
                  ) : null}
                  {preview.ads.map((ad) => (
                    <figure key={ad.claim} className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ad.image}
                        alt=""
                        className="w-full rounded-md border"
                      />
                      <figcaption className="text-sm">
                        <span className="font-medium">{ad.claim}</span>
                        <span className="mt-1 block text-muted-foreground">
                          {ad.headlines.join(" · ")}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connecting Google Ads and Meta is part of Growth.
            </p>
          )}
        </CardContent>
      </Card>
      {handoff ? (
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
                    await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/clio", {
                      method: "DELETE",
                    }),
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
      ) : null}
    </div>
  );
}

function AssetThumb({
  id,
  name,
  onRemove,
}: {
  id: string;
  name: string;
  onRemove: () => Promise<void>;
}) {
  const image = useAsync(async () => {
    const response = await apiFetch(`/api/tenant/acquisition/assets/${id}`, {
      returnType: "response",
    });
    return URL.createObjectURL(await response.blob());
  }, [id], { withUseEffect: true, initialState: null });

  useEffect(() => {
    const url = image.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [image.data]);

  return (
    <figure className="space-y-2">
      {image.data ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.data} alt="" className="h-28 w-full rounded-md border object-cover" />
      ) : (
        <div className="h-28 rounded-md border bg-muted" />
      )}
      <figcaption className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{name}</span>
        <AsyncButton variant="outline" onClick={onRemove} pendingText="Removing...">
          Remove
        </AsyncButton>
      </figcaption>
    </figure>
  );
}
