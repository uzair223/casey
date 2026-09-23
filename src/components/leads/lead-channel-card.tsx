"use client";

import { useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api-utils";
import { useAsync } from "@/hooks/useAsync";
import { toast } from "@/lib/toast";

type ChannelResponse = {
  publicSlug: string | null;
  premium: boolean;
  hostedUrl: string | null;
  localPath: string | null;
  leadTypes: Array<{
    id: string;
    name: string;
    publicSlug: string | null;
  }>;
  channels: Array<{
    id: string;
    leadTypeId: string;
    leadTypeName: string;
    publicKey: string;
    snippet: string;
    enabled: boolean;
  }>;
};

export function LeadChannelCard() {
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#1f3a2e");
  const [logoUrl, setLogoUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [hideCaseyMark, setHideCaseyMark] = useState(false);
  const channels = useAsync(async () => {
    return apiFetch<ChannelResponse>("/api/tenant/lead-channels");
  }, []);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Public intake</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hosted page for every plan. The embeddable widget and branding are on Growth.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="lead-slug">Public address</Label>
            <Input
              id="lead-slug"
              value={slug}
              placeholder={channels.data?.publicSlug ?? "firm-name"}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-color">Colour</Label>
            <Input
              id="lead-color"
              value={color}
              disabled={!channels.data?.premium}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-logo">Logo URL</Label>
            <Input
              id="lead-logo"
              value={logoUrl}
              disabled={!channels.data?.premium}
              onChange={(event) => setLogoUrl(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-display">Display name</Label>
            <Input
              id="lead-display"
              value={displayName}
              disabled={!channels.data?.premium}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="lead-welcome">Welcome line</Label>
            <Input
              id="lead-welcome"
              value={welcome}
              disabled={!channels.data?.premium}
              onChange={(event) => setWelcome(event.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hideCaseyMark}
            disabled={!channels.data?.premium}
            onChange={(event) => setHideCaseyMark(event.target.checked)}
          />
          Hide the Casey mark
        </label>
        <AsyncButton
          type="button"
          pendingText="Saving..."
          onClick={async () => {
            await apiFetch("/api/tenant/lead-channels", {
              method: "POST",
              body: JSON.stringify({
                publicSlug: slug || undefined,
                branding: channels.data?.premium
                  ? {
                      primaryColor: color,
                      logoUrl,
                      displayName,
                      welcome,
                      hideCaseyMark,
                    }
                  : undefined,
              }),
            });
            await channels.handler();
            toast.success("Public intake saved");
          }}
        >
          Enable hosted page
        </AsyncButton>
        {channels.data?.hostedUrl ? (
          <p className="text-sm">
            Hosted page:{" "}
            <a className="underline" href={channels.data.localPath ?? channels.data.hostedUrl}>
              {channels.data.hostedUrl}
            </a>
          </p>
        ) : null}
        {(channels.data?.leadTypes ?? []).map((leadType) => {
          const channel = (channels.data?.channels ?? []).find(
            (item) => item.leadTypeId === leadType.id,
          );
          return (
          <div key={leadType.id} className="space-y-1">
            <p className="text-sm font-medium">{leadType.name}</p>
            <p className="break-all text-xs text-muted-foreground">
              {channel && channels.data?.premium
                ? channel.snippet
                : channel
                  ? "Upgrade to Growth to embed this on the firm website."
                  : "Not on the hosted page yet."}
            </p>
            <div className="flex gap-2">
              {channel && channels.data?.premium ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(channel.snippet);
                    toast.success("Snippet copied");
                  }}
                >
                  Copy snippet
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await apiFetch("/api/tenant/lead-channels", {
                    method: "POST",
                    body: JSON.stringify({
                      leadTypeId: leadType.id,
                      publicSlug: slug || channels.data?.publicSlug || undefined,
                      enabled: channel ? !channel.enabled : true,
                    }),
                  });
                  await channels.handler();
                  toast.success(
                    channel?.enabled ? "Lead type paused" : "Lead type enabled",
                  );
                }}
              >
                {channel?.enabled ? "Pause" : "Enable"}
              </Button>
            </div>
          </div>
        );
        })}
      </CardContent>
    </Card>
  );
}
