"use client";

import { useEffect, useState } from "react";

import { useAcquisitionBoard } from "@/components/leads/acquisition-settings";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import type { AcquisitionBoard } from "@/lib/leads/acquisition/types";
import { toast } from "@/lib/toast";

type ChannelResponse = {
  publicSlug: string | null;
  leadTypes: Array<{ id: string; name: string }>;
  channels: Array<{ leadTypeId: string; enabled: boolean }>;
};

function ProposalImage({ id }: { id: string }) {
  const image = useAsync(async () => {
    const response = await apiFetch(`/api/tenant/acquisition/proposals/${id}`, { returnType: "response" });
    return URL.createObjectURL(await response.blob());
  }, [id], { withUseEffect: true, initialState: null });
  useEffect(() => {
    const url = image.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [image.data]);
  if (!image.data) return <div className="h-24 rounded-md border bg-muted" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image.data} alt="" className="h-24 w-full rounded-md border object-cover" />
  );
}

function LibraryImage({ id, name, onRemove }: { id: string; name: string; onRemove: () => Promise<void> }) {
  const image = useAsync(async () => {
    const response = await apiFetch(`/api/tenant/acquisition/assets/${id}`, { returnType: "response" });
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

export function FirmStudio() {
  const board = useAcquisitionBoard();
  const channels = useAsync(
    () => apiFetch<ChannelResponse>("/api/tenant/lead-channels"),
    [],
    { withUseEffect: true, initialState: null },
  );
  const [website, setWebsite] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const data = board.data;
  const proposal = data?.proposal ?? null;

  async function approve(selection: {
    language?: boolean;
    colours?: boolean;
    places?: boolean;
    claims?: boolean;
    imageIds?: string[];
  }) {
    const next = await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/site/approve", {
      method: "POST",
      body: JSON.stringify(selection),
    });
    board.setData(next);
    setChosen([]);
    toast.success("Saved");
  }

  return (
    <MarketingFrame
      title="Firm studio"
      description="Casey reads the website and waits for you to approve the language, colours, and images."
    >
      {!data?.growth ? (
        <p className="text-sm text-muted-foreground">The firm studio is part of Growth.</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Website</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={website ?? data.website?.url ?? ""}
                  placeholder="https://"
                  onChange={(event) => setWebsite(event.target.value)}
                />
                <AsyncButton
                  variant="outline"
                  pendingText="Reading..."
                  onClick={async () => {
                    const next = await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/site", {
                      method: "POST",
                      body: JSON.stringify({ url: website ?? data.website?.url ?? "" }),
                    });
                    board.setData(next);
                    setWebsite(null);
                    toast.success("Website read. Approve what should be kept.");
                  }}
                >
                  Read website
                </AsyncButton>
              </div>
              {proposal ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Language</p>
                    <p className="text-sm text-muted-foreground">{proposal.title || "No name found."}</p>
                    <p className="text-sm text-muted-foreground">{proposal.summary || "No description found."}</p>
                    <p className="text-sm text-muted-foreground">{proposal.welcome || "No welcome line found."}</p>
                    <AsyncButton type="button" variant="outline" pendingText="Saving..." onClick={() => approve({ language: true })}>
                      Use this language
                    </AsyncButton>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Colours</p>
                    <div className="flex gap-2">
                      {proposal.colours.length ? proposal.colours.map((colour) => (
                        <span key={colour} className="h-8 w-8 rounded-md border" style={{ background: colour }} title={colour} />
                      )) : <p className="text-sm text-muted-foreground">No colours found.</p>}
                    </div>
                    {proposal.colours.length ? (
                      <AsyncButton type="button" variant="outline" pendingText="Saving..." onClick={() => approve({ colours: true })}>
                        Use these colours
                      </AsyncButton>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Images</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {proposal.images.map((image) => (
                        <label key={image.id} className="space-y-2 text-sm">
                          <ProposalImage id={image.id} />
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={chosen.includes(image.id)}
                              onChange={(event) => {
                                setChosen((current) =>
                                  event.target.checked
                                    ? [...current, image.id]
                                    : current.filter((id) => id !== image.id),
                                );
                              }}
                            />
                            Keep
                          </span>
                        </label>
                      ))}
                    </div>
                    {proposal.images.length ? (
                      <AsyncButton
                        type="button"
                        variant="outline"
                        disabled={!chosen.length}
                        pendingText="Saving..."
                        onClick={() => approve({ imageIds: chosen })}
                      >
                        Add the selected images
                      </AsyncButton>
                    ) : (
                      <p className="text-sm text-muted-foreground">No images found on the page.</p>
                    )}
                  </div>
                  {proposal.places.length ? (
                    <div className="space-y-2">
                      <p className="text-sm">Places named on the site: {proposal.places.join(", ")}.</p>
                      <AsyncButton type="button" variant="outline" pendingText="Saving..." onClick={() => approve({ places: true })}>
                        Use these places
                      </AsyncButton>
                    </div>
                  ) : null}
                  {proposal.claims.length ? (
                    <p className="text-sm text-muted-foreground">
                      The site talks about {proposal.claims.join(", ")}. Turn those lead types on if they should be advertised.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter the firm website. Casey will suggest language, colours, and images for you to approve.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Image library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="library-image">Upload a PNG or JPEG</Label>
              <Input
                id="library-image"
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const body = new FormData();
                  body.append("file", file);
                  board.setData(await apiFetch<AcquisitionBoard>("/api/tenant/acquisition/assets", { method: "POST", body }));
                  toast.success("Image added");
                }}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {data.assets.map((asset) => (
                  <LibraryImage
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lead types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(channels.data?.leadTypes ?? []).map((leadType) => {
                const channel = channels.data?.channels.find((item) => item.leadTypeId === leadType.id);
                return (
                  <div key={leadType.id} className="flex items-center justify-between gap-3">
                    <p className="text-sm">{leadType.name}</p>
                    <AsyncButton
                      variant="outline"
                      pendingText="Saving..."
                      onClick={async () => {
                        if (!channels.data?.publicSlug) throw new Error("Set the public address in the widget studio first.");
                        await apiFetch("/api/tenant/lead-channels", {
                          method: "POST",
                          body: JSON.stringify({
                            leadTypeId: leadType.id,
                            publicSlug: channels.data.publicSlug,
                            enabled: channel ? !channel.enabled : true,
                          }),
                        });
                        await channels.handler();
                      }}
                    >
                      {channel?.enabled ? "On" : "Off"}
                    </AsyncButton>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </MarketingFrame>
  );
}
