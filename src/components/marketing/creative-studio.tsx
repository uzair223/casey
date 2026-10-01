"use client";

import { useEffect, useState } from "react";

import { useAcquisitionBoard } from "@/components/leads/acquisition-settings";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
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

type CreativeAd = {
  claim: string;
  headlines: string[];
  descriptions: string[];
  prompt: string;
  imageMode: "generate" | "library";
  referenceAssetIds: string[];
  libraryAssetId: string | null;
  paused: boolean;
};

type CreativeDraft = {
  places: string[];
  assets: Array<{ id: string; name: string }>;
  allowance: { used: number; limit: number; remaining: number };
  recommendation: string | null;
  results: Array<{
    claim: string;
    spendMinor: number;
    started: number;
    accepted: number;
    declined: number;
    costPerAcceptedMinor: number | null;
  }>;
  ads: CreativeAd[];
};

type Forecast = {
  google: { impressions: number; clicks: number; costMinor: number } | null;
  meta: { reach: number; impressions: number } | null;
  googleNote: string | null;
  metaNote: string | null;
};

type SearchTerms = {
  terms: Array<{ term: string; clicks: number; costMinor: number }>;
  note: string | null;
};

function pounds(minor: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
}

async function openConnection(path: string) {
  const payload = await apiFetch<{ url: string }>(path);
  window.location.href = payload.url;
}

export function CreativeStudio() {
  const board = useAcquisitionBoard();
  const draft = useAsync(() => apiFetch<CreativeDraft>("/api/tenant/acquisition/creative"), [], {
    withUseEffect: true,
    initialState: null,
  });
  const [edits, setEdits] = useState<CreativeAd[] | null>(null);
  const [places, setPlaces] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [preview, setPreview] = useState<AcquisitionPreview | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [terms, setTerms] = useState<SearchTerms | null>(null);
  const data = board.data;
  const ads = edits ?? draft.data?.ads ?? [];
  const savedBudget = data?.campaigns.find((campaign) => campaign.monthlyBudgetGbp)?.monthlyBudgetGbp;
  const budgetValue = budget ?? (savedBudget ? String(savedBudget) : "300");
  const placesValue = places ?? (draft.data?.places ?? []).join("\n");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const connected = params.get("connected");
    if (!error && connected !== "google" && connected !== "meta") return;
    if (error) toast.error(error);
    if (connected === "google") toast.success("Google Ads connected");
    if (connected === "meta") toast.success("Meta connected");
    window.history.replaceState(null, "", "/dashboard/marketing/creative");
  }, []);

  function updateAd(claim: string, patch: Partial<CreativeAd>) {
    setEdits(ads.map((ad) => (ad.claim === claim ? { ...ad, ...patch } : ad)));
  }

  async function saveCampaign(action: "run" | "pause" | "resume") {
    if (edits) {
      await apiFetch("/api/tenant/acquisition/creative", {
        method: "POST",
        body: JSON.stringify({ ads: edits }),
      });
    }
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
    setEdits(null);
    await draft.handler();
    toast.success(action === "pause" ? "Campaigns paused" : "Campaigns updated");
  }

  return (
    <MarketingFrame
      title="Creative studio"
      description="One ad for each lead type. Edit it, then run it, and see whether it brought enquiries the firm accepted."
    >
      {!data?.growth ? (
        <p className="text-sm text-muted-foreground">The creative studio is part of Growth.</p>
      ) : (
        <div className="space-y-4">
          {draft.error ? <p className="text-sm text-muted-foreground">{draft.error.message}</p> : null}
          <Card>
            <CardHeader>
              <CardTitle>Accounts and budget</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <AsyncButton variant="outline" disabled={!data.googleConfigured} pendingText="Opening Google..." onClick={() => openConnection("/api/tenant/acquisition/google/start")}>
                  {data.googleConnected ? "Reconnect Google Ads" : "Connect Google Ads"}
                </AsyncButton>
                <AsyncButton variant="outline" disabled={!data.metaConfigured} pendingText="Opening Meta..." onClick={() => openConnection("/api/tenant/acquisition/meta/start")}>
                  {data.metaConnected ? "Reconnect Meta" : "Connect Meta"}
                </AsyncButton>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ad-places">Places</Label>
                  <Textarea id="ad-places" value={placesValue} onChange={(event) => setPlaces(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-budget">Monthly budget (£)</Label>
                  <Input id="monthly-budget" inputMode="numeric" value={budgetValue} onChange={(event) => setBudget(event.target.value.replace(/[^\d]/g, ""))} />
                  <p className="text-sm text-muted-foreground">
                    {draft.data ? `${draft.data.allowance.remaining} of ${draft.data.allowance.limit} photographs left this period.` : null}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AsyncButton onClick={() => saveCampaign("run")} pendingText="Starting...">Run campaigns</AsyncButton>
                <AsyncButton variant="outline" onClick={() => saveCampaign("pause")} pendingText="Pausing...">Pause</AsyncButton>
                <AsyncButton variant="outline" onClick={() => saveCampaign("resume")} pendingText="Resuming...">Resume</AsyncButton>
                <AsyncButton
                  variant="outline"
                  pendingText="Estimating..."
                  onClick={async () => {
                    setForecast(await apiFetch<Forecast>("/api/tenant/acquisition/forecast", {
                      method: "POST",
                      body: JSON.stringify({ monthlyBudgetGbp: Number(budgetValue) }),
                    }));
                  }}
                >
                  Estimate reach
                </AsyncButton>
                <AsyncButton
                  variant="outline"
                  pendingText="Drawing ads..."
                  onClick={async () => {
                    if (edits) {
                      await apiFetch("/api/tenant/acquisition/creative", {
                        method: "POST",
                        body: JSON.stringify({ ads: edits }),
                      });
                    }
                    setPreview(await apiFetch<AcquisitionPreview>("/api/tenant/acquisition/preview", {
                      method: "POST",
                      body: JSON.stringify({ places: placesValue }),
                    }));
                    await draft.handler();
                  }}
                >
                  Make photographs
                </AsyncButton>
              </div>
              {forecast ? (
                <div className="space-y-1 text-sm">
                  <p>
                    {forecast.google
                      ? `Google estimates ${forecast.google.impressions.toLocaleString("en-GB")} impressions, ${forecast.google.clicks.toLocaleString("en-GB")} clicks, and ${pounds(forecast.google.costMinor)}.`
                      : forecast.googleNote}
                  </p>
                  <p>
                    {forecast.meta
                      ? `Meta estimates a reach of ${forecast.meta.reach.toLocaleString("en-GB")} and ${forecast.meta.impressions.toLocaleString("en-GB")} impressions.`
                      : forecast.metaNote}
                  </p>
                </div>
              ) : null}
              {draft.data?.recommendation ? <p className="text-sm">{draft.data.recommendation}</p> : null}
            </CardContent>
          </Card>
          {ads.map((ad) => {
            const result = draft.data?.results.find((row) => row.claim === ad.claim);
            const image = preview?.ads.find((item) => item.claim === ad.claim)?.image;
            return (
              <Card key={ad.claim}>
                <CardHeader>
                  <CardTitle>{ad.claim}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ad.headlines.map((headline, index) => (
                    <Input
                      key={`${ad.claim}-headline-${index}`}
                      value={headline}
                      onChange={(event) => {
                        const headlines = [...ad.headlines];
                        headlines[index] = event.target.value;
                        updateAd(ad.claim, { headlines });
                      }}
                    />
                  ))}
                  <Textarea
                    value={ad.descriptions[0] ?? ""}
                    onChange={(event) => updateAd(ad.claim, { descriptions: [event.target.value, ...ad.descriptions.slice(1)] })}
                  />
                  <Textarea
                    value={ad.prompt}
                    placeholder="Direction for the photograph"
                    onChange={(event) => updateAd(ad.claim, { prompt: event.target.value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(draft.data?.assets ?? []).map((asset) => {
                      const selected = ad.referenceAssetIds.includes(asset.id);
                      return (
                        <Button
                          key={asset.id}
                          type="button"
                          size="sm"
                          variant={selected ? "default" : "outline"}
                          onClick={() => {
                            const referenceAssetIds = selected
                              ? ad.referenceAssetIds.filter((id) => id !== asset.id)
                              : [...ad.referenceAssetIds, asset.id].slice(0, 4);
                            updateAd(ad.claim, { referenceAssetIds });
                          }}
                        >
                          {asset.name}
                        </Button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ad.imageMode === "library"}
                      onChange={(event) => updateAd(ad.claim, {
                        imageMode: event.target.checked ? "library" : "generate",
                        libraryAssetId: event.target.checked ? ad.referenceAssetIds[0] ?? ad.libraryAssetId : null,
                      })}
                    />
                    Use a library image as the finished picture
                  </label>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="w-full max-w-sm rounded-md border" />
                  ) : null}
                  {result ? (
                    <p className="text-sm text-muted-foreground">
                      {pounds(result.spendMinor)} spent · {result.started} started · {result.accepted} accepted · {result.declined} declined
                      {result.costPerAcceptedMinor != null ? ` · ${pounds(result.costPerAcceptedMinor)} per accepted lead` : ""}
                    </p>
                  ) : null}
                  <AsyncButton
                    variant="outline"
                    pendingText="Saving..."
                    onClick={async () => {
                      const nextAds = ads.map((item) =>
                        item.claim === ad.claim ? { ...item, paused: !item.paused } : item,
                      );
                      await apiFetch("/api/tenant/acquisition/creative", {
                        method: "POST",
                        body: JSON.stringify({ ads: nextAds }),
                      });
                      const next = await apiFetch<CreativeDraft>("/api/tenant/acquisition/creative/pause", {
                        method: "POST",
                        body: JSON.stringify({ claim: ad.claim, paused: !ad.paused }),
                      });
                      draft.setData(next);
                      setEdits(null);
                    }}
                  >
                    {ad.paused ? "Paused" : "Pause this lead type"}
                  </AsyncButton>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader>
              <CardTitle>Google searches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AsyncButton
                variant="outline"
                pendingText="Loading..."
                onClick={async () => setTerms(await apiFetch<SearchTerms>("/api/tenant/acquisition/search-terms"))}
              >
                Show searches
              </AsyncButton>
              {terms?.note ? <p className="text-sm text-muted-foreground">{terms.note}</p> : null}
              <ul className="space-y-2 text-sm">
                {(terms?.terms ?? []).map((term) => (
                  <li key={term.term} className="flex items-center justify-between gap-3">
                    <span>{term.term} · {term.clicks} clicks · {pounds(term.costMinor)}</span>
                    <AsyncButton
                      variant="outline"
                      pendingText="Blocking..."
                      onClick={async () => {
                        await apiFetch("/api/tenant/acquisition/search-terms", {
                          method: "POST",
                          body: JSON.stringify({ term: term.term }),
                        });
                        toast.success("Search blocked");
                      }}
                    >
                      Block
                    </AsyncButton>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </MarketingFrame>
  );
}
