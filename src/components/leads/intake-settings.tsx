"use client";

import { useEffect, useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntakePreview } from "@/components/leads/intake-preview";
import Loading from "@/components/loading";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { firmPageUrl } from "@/lib/firm-page-host";
import { slugifyPublicAddress } from "@/lib/leads/logo";
import type { LeadBranding } from "@/lib/leads/schema";
import { toast } from "@/lib/toast";

type ChannelResponse = {
  tenantName: string;
  publicSlug: string | null;
  premium: boolean;
  branding: LeadBranding;
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

const DEFAULT_COLOR = "#1f3a2e";

export function IntakeSettings() {
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [hideCaseyMark, setHideCaseyMark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const channels = useAsync(async () => {
    return apiFetch<ChannelResponse>("/api/tenant/lead-channels");
  }, []);

  useEffect(() => {
    if (!channels.data || hydrated) return;
    const branding = channels.data.branding ?? {};
    setSlug(channels.data.publicSlug ?? "");
    setColor(branding.primaryColor || DEFAULT_COLOR);
    setLogoUrl(branding.logoUrl || "");
    setDisplayName(branding.displayName || "");
    setWelcome(branding.welcome || "");
    setHideCaseyMark(Boolean(branding.hideCaseyMark));
    setHydrated(true);
  }, [channels.data, hydrated]);

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  if (channels.isLoading && !channels.data) {
    return <Loading />;
  }

  const premium = Boolean(channels.data?.premium);
  const tenantName = channels.data?.tenantName || "Your firm";
  const address = slugifyPublicAddress(slug);
  const previewFirm = premium && displayName.trim() ? displayName.trim() : tenantName;
  const previewWelcome =
    (premium ? welcome.trim() : "") ||
    `Tell ${previewFirm} what happened. Casey will ask for the details they need.`;
  const enabledLeadTypes = (channels.data?.leadTypes ?? []).filter((leadType) =>
    (channels.data?.channels ?? []).some(
      (channel) => channel.leadTypeId === leadType.id && channel.enabled,
    ),
  );
  const brandingPayload = (): LeadBranding => ({
    primaryColor: color,
    logoUrl,
    displayName,
    welcome,
    hideCaseyMark,
  });

  const save = async () => {
    const saved = await apiFetch<{
      publicSlug: string | null;
      branding: LeadBranding;
      hostedUrl: string | null;
    }>("/api/tenant/lead-channels", {
      method: "POST",
      body: JSON.stringify({
        publicSlug: slug,
        branding: premium ? brandingPayload() : undefined,
      }),
    });
    if (saved.publicSlug) setSlug(saved.publicSlug);
    if (saved.branding?.logoUrl) setLogoUrl(saved.branding.logoUrl);
    if (logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview("");
    }
    await channels.handler();
    toast.success("Public intake saved");
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="space-y-4">
        <Card>
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <CardHeader>
              <CardTitle>Hosted page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Every plan gets a hosted page. Colours, the logo, and the welcome line are part of Growth.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="lead-slug">Public address</Label>
                  <Input
                    id="lead-slug"
                    value={slug}
                    placeholder={channels.data?.publicSlug ?? "firm-name"}
                    onChange={(event) => setSlug(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {firmPageUrl(address || "firm-name")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-color">Colour</Label>
                  <div className="flex gap-2">
                    <Input
                      id="lead-color"
                      type="color"
                      className="h-9 w-14 shrink-0 p-1"
                      value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_COLOR}
                      disabled={!premium}
                      onChange={(event) => setColor(event.target.value)}
                    />
                    <Input
                      value={color}
                      disabled={!premium}
                      onChange={(event) => setColor(event.target.value)}
                      aria-label="Colour hex"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-logo">Logo</Label>
                  <Input
                    id="lead-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={!premium}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      const preview = URL.createObjectURL(file);
                      setLogoPreview((current) => {
                        if (current.startsWith("blob:")) URL.revokeObjectURL(current);
                        return preview;
                      });
                      try {
                        const form = new FormData();
                        form.append("file", file);
                        const uploaded = await apiFetch<{ logoUrl: string }>(
                          "/api/tenant/lead-channels/logo",
                          { method: "POST", body: form },
                        );
                        if (uploaded.logoUrl) {
                          setLogoUrl(uploaded.logoUrl);
                          setLogoPreview((current) => {
                            if (current.startsWith("blob:")) URL.revokeObjectURL(current);
                            return "";
                          });
                        }
                        toast.success("Logo uploaded");
                      } catch (error) {
                        toast.errorFromUnknown(error, "Failed to upload logo");
                      }
                    }}
                  />
                  {logoUrl || logoPreview ? (
                    <AsyncButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-0"
                      disabled={!premium}
                      pendingText="Removing..."
                      onClick={async () => {
                        await apiFetch("/api/tenant/lead-channels/logo", {
                          method: "DELETE",
                        });
                        setLogoUrl("");
                        setLogoPreview((current) => {
                          if (current.startsWith("blob:")) URL.revokeObjectURL(current);
                          return "";
                        });
                        toast.success("Logo removed");
                      }}
                    >
                      Remove logo
                    </AsyncButton>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lead-display">Display name</Label>
                  <Input
                    id="lead-display"
                    value={displayName}
                    disabled={!premium}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="lead-welcome">Welcome line</Label>
                  <Input
                    id="lead-welcome"
                    value={welcome}
                    disabled={!premium}
                    onChange={(event) => setWelcome(event.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hideCaseyMark}
                  disabled={!premium}
                  onChange={(event) => setHideCaseyMark(event.target.checked)}
                />
                Hide the Casey mark
              </label>
              {channels.data?.hostedUrl ? (
                <p className="text-sm">
                  Live page:{" "}
                  <a
                    className="underline"
                    href={channels.data.localPath ?? channels.data.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {channels.data.hostedUrl}
                  </a>
                </p>
              ) : null}
            </CardContent>
            <CardFooter>
              <AsyncButton type="button" pendingText="Saving..." onClick={save}>
                Save public intake
              </AsyncButton>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead types on the page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(channels.data?.leadTypes ?? []).map((leadType) => {
              const channel = (channels.data?.channels ?? []).find(
                (item) => item.leadTypeId === leadType.id,
              );
              return (
                <div key={leadType.id} className="space-y-1">
                  <p className="text-sm font-medium">{leadType.name}</p>
                  <p className="break-all text-xs text-muted-foreground">
                    {channel && premium
                      ? channel.snippet
                      : channel
                        ? "Upgrade to Growth to embed this on the firm website."
                        : "Not on the hosted page yet."}
                  </p>
                  <div className="flex gap-2">
                    {channel && premium ? (
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
                    <AsyncButton
                      type="button"
                      variant="outline"
                      size="sm"
                      pendingText={channel?.enabled ? "Pausing..." : "Enabling..."}
                      onClick={async () => {
                        const address = slugifyPublicAddress(
                          slug || channels.data?.publicSlug || "",
                        );
                        if (!address) {
                          throw new Error("Choose a public address first");
                        }
                        await apiFetch("/api/tenant/lead-channels", {
                          method: "POST",
                          body: JSON.stringify({
                            leadTypeId: leadType.id,
                            publicSlug: address,
                            enabled: channel ? !channel.enabled : true,
                            branding: premium ? brandingPayload() : undefined,
                          }),
                        });
                        await channels.handler();
                        toast.success(
                          channel?.enabled ? "Lead type paused" : "Lead type enabled",
                        );
                      }}
                    >
                      {channel?.enabled ? "Pause" : "Enable"}
                    </AsyncButton>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="xl:sticky xl:top-24">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {enabledLeadTypes.length > 0
              ? "What an enquirer sees on the hosted page."
              : "Enable a lead type to publish the page. This is how it will look."}
          </p>
          <IntakePreview
            key={enabledLeadTypes.map((leadType) => leadType.id).join(",")}
            firmName={previewFirm}
            welcome={previewWelcome}
            primaryColor={premium ? color : DEFAULT_COLOR}
            logoUrl={premium ? logoPreview || logoUrl : ""}
            hideCaseyMark={premium && hideCaseyMark}
            leadTypeNames={enabledLeadTypes.map((leadType) => leadType.name)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
