"use client";

import { useEffect, useState } from "react";
import {
  FormProvider,
  useForm,
  useWatch,
  type SubmitHandler,
} from "react-hook-form";

import { CopyIcon } from "@/components/icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ColorField } from "@/components/ui/color-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RhfField } from "@/components/ui/rhf-field";
import { IntakePreview } from "@/components/leads/intake-preview";
import Loading from "@/components/loading";
import { useAsync } from "@/hooks/useAsync";
import { apiFetch } from "@/lib/api-utils";
import { firmPageUrl } from "@/lib/firm-page-host";
import { slugifyPublicAddress } from "@/lib/leads/logo";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  DEFAULT_LEAD_HEADER_COLOR,
  DEFAULT_LEAD_TEXT_COLOR,
  DEFAULT_LEAD_USER_BUBBLE_COLOR,
  DEFAULT_SELECTOR_CAPTION,
  defaultSelectorTitle,
  leadHexColor,
  selectorCopy,
  type LeadBranding,
} from "@/lib/leads/schema";
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

type IntakeSettingsValues = {
  publicSlug: string;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  userBubbleColor: string;
  logoUrl: string;
  displayName: string;
  welcome: string;
  selectorTitle: string;
  selectorCaption: string;
  hideCaseyMark: boolean;
  hideAvatars: boolean;
};

function valuesFromData(data: ChannelResponse | null): IntakeSettingsValues {
  const branding = data?.branding ?? {};
  return {
    publicSlug: data?.publicSlug ?? "",
    primaryColor: branding.primaryColor || DEFAULT_LEAD_HEADER_COLOR,
    textColor: branding.textColor || DEFAULT_LEAD_TEXT_COLOR,
    backgroundColor: branding.backgroundColor || DEFAULT_LEAD_BACKGROUND_COLOR,
    userBubbleColor:
      branding.userBubbleColor || DEFAULT_LEAD_USER_BUBBLE_COLOR,
    logoUrl: branding.logoUrl || "",
    displayName: branding.displayName || "",
    welcome: branding.welcome || "",
    selectorTitle: branding.selectorTitle || "",
    selectorCaption: branding.selectorCaption || "",
    hideCaseyMark: Boolean(branding.hideCaseyMark),
    hideAvatars: Boolean(branding.hideAvatars),
  };
}

function brandingFromValues(values: IntakeSettingsValues): LeadBranding {
  return {
    primaryColor: values.primaryColor,
    logoUrl: values.logoUrl,
    displayName: values.displayName,
    welcome: values.welcome,
    hideCaseyMark: values.hideCaseyMark,
    hideAvatars: values.hideAvatars,
    selectorTitle: values.selectorTitle,
    selectorCaption: values.selectorCaption,
    textColor: values.textColor,
    backgroundColor: values.backgroundColor,
    userBubbleColor: values.userBubbleColor,
  };
}

export function IntakeSettings() {
  const channels = useAsync(async () => {
    return apiFetch<ChannelResponse>("/api/tenant/lead-channels");
  }, []);

  if (channels.isLoading && !channels.data) {
    return <Loading />;
  }

  return (
    <IntakeSettingsForm data={channels.data} reload={channels.handler} />
  );
}

function IntakeSettingsForm({
  data,
  reload,
}: {
  data: ChannelResponse | null;
  reload: () => Promise<ChannelResponse | undefined>;
}) {
  const form = useForm<IntakeSettingsValues>({
    defaultValues: valuesFromData(data),
  });
  const [logoPreview, setLogoPreview] = useState("");
  const values = useWatch({ control: form.control });

  useEffect(() => {
    return () => {
      if (logoPreview.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const premium = Boolean(data?.premium);
  const tenantName = data?.tenantName || "Your firm";
  const publicSlug = values.publicSlug ?? "";
  const address = slugifyPublicAddress(publicSlug);
  const displayName = values.displayName ?? "";
  const welcome = values.welcome ?? "";
  const selectorTitle = values.selectorTitle ?? "";
  const selectorCaption = values.selectorCaption ?? "";
  const primaryColor = values.primaryColor ?? DEFAULT_LEAD_HEADER_COLOR;
  const textColor = values.textColor ?? DEFAULT_LEAD_TEXT_COLOR;
  const backgroundColor =
    values.backgroundColor ?? DEFAULT_LEAD_BACKGROUND_COLOR;
  const userBubbleColor =
    values.userBubbleColor ?? DEFAULT_LEAD_USER_BUBBLE_COLOR;
  const logoUrl = values.logoUrl ?? "";
  const hideCaseyMark = Boolean(values.hideCaseyMark);
  const hideAvatars = Boolean(values.hideAvatars);

  const previewFirm =
    premium && displayName.trim() ? displayName.trim() : tenantName;
  const previewWelcome =
    (premium ? welcome.trim() : "") ||
    `Tell ${previewFirm} what happened. Casey will ask for the details they need.`;
  const previewTitle = premium
    ? selectorCopy(selectorTitle, defaultSelectorTitle(previewFirm))
    : defaultSelectorTitle(previewFirm);
  const previewCaption = premium
    ? selectorCopy(selectorCaption, DEFAULT_SELECTOR_CAPTION)
    : DEFAULT_SELECTOR_CAPTION;
  const previewHeader = leadHexColor(
    premium ? primaryColor : DEFAULT_LEAD_HEADER_COLOR,
    DEFAULT_LEAD_HEADER_COLOR,
  );
  const previewText = leadHexColor(
    premium ? textColor : DEFAULT_LEAD_TEXT_COLOR,
    DEFAULT_LEAD_TEXT_COLOR,
  );
  const previewBackground = leadHexColor(
    premium ? backgroundColor : DEFAULT_LEAD_BACKGROUND_COLOR,
    DEFAULT_LEAD_BACKGROUND_COLOR,
  );
  const previewUserBubble = leadHexColor(
    premium ? userBubbleColor : DEFAULT_LEAD_USER_BUBBLE_COLOR,
    DEFAULT_LEAD_USER_BUBBLE_COLOR,
  );
  const enabledLeadTypes = (data?.leadTypes ?? []).filter((leadType) =>
    (data?.channels ?? []).some(
      (channel) => channel.leadTypeId === leadType.id && channel.enabled,
    ),
  );
  const hostedLive = Boolean(data?.hostedUrl) && enabledLeadTypes.length > 0;

  const onSubmit: SubmitHandler<IntakeSettingsValues> = async (formValues) => {
    const saved = await apiFetch<{
      publicSlug: string | null;
      branding: LeadBranding;
      hostedUrl: string | null;
    }>("/api/tenant/lead-channels", {
      method: "POST",
      body: JSON.stringify({
        publicSlug: formValues.publicSlug,
        branding: premium ? brandingFromValues(formValues) : undefined,
      }),
    });
    if (saved.publicSlug) {
      form.setValue("publicSlug", saved.publicSlug);
    }
    if (saved.branding?.logoUrl) {
      form.setValue("logoUrl", saved.branding.logoUrl);
    }
    if (logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview("");
    }
    await reload();
    toast.success("Public intake saved");
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="space-y-4">
        <Card>
          <FormProvider {...form}>
            <form
              className="flex flex-col gap-2"
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Hosted page</CardTitle>
                  <Badge
                    variant={hostedLive ? "default" : "warning"}
                    className="gap-1.5 rounded-full"
                  >
                    <span
                      className={
                        hostedLive
                          ? "size-1.5 rounded-full bg-primary-foreground"
                          : "size-1.5 rounded-full bg-warning-foreground"
                      }
                    />
                    {hostedLive ? "Live" : "Paused"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Every plan gets a hosted page. Colours, the logo, and the
                  wording are part of Growth.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1 md:col-span-2">
                    <RhfField
                      form={form}
                      name="publicSlug"
                      controlId="lead-slug"
                      label="Public address"
                      renderControl={(registration) => (
                        <Input
                          id="lead-slug"
                          placeholder={data?.publicSlug ?? "firm-name"}
                          {...registration}
                        />
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      {firmPageUrl(address || "firm-name")}
                    </p>
                  </div>
                  <RhfField
                    form={form}
                    name="primaryColor"
                    controlId="lead-color"
                    label="Primary colour"
                    renderControl={(registration) => (
                      <ColorField
                        id="lead-color"
                        fallback={DEFAULT_LEAD_HEADER_COLOR}
                        disabled={!premium}
                        hexAriaLabel="Primary colour hex"
                        {...registration}
                      />
                    )}
                  />
                  <RhfField
                    form={form}
                    name="textColor"
                    controlId="lead-text"
                    label="Text colour"
                    renderControl={(registration) => (
                      <ColorField
                        id="lead-text"
                        fallback={DEFAULT_LEAD_TEXT_COLOR}
                        disabled={!premium}
                        hexAriaLabel="Text colour hex"
                        {...registration}
                      />
                    )}
                  />
                  <RhfField
                    form={form}
                    name="backgroundColor"
                    controlId="lead-background"
                    label="Background colour"
                    renderControl={(registration) => (
                      <ColorField
                        id="lead-background"
                        fallback={DEFAULT_LEAD_BACKGROUND_COLOR}
                        disabled={!premium}
                        hexAriaLabel="Background colour hex"
                        {...registration}
                      />
                    )}
                  />
                  <RhfField
                    form={form}
                    name="userBubbleColor"
                    controlId="lead-user-bubble"
                    label="User bubble colour"
                    renderControl={(registration) => (
                      <ColorField
                        id="lead-user-bubble"
                        fallback={DEFAULT_LEAD_USER_BUBBLE_COLOR}
                        disabled={!premium}
                        hexAriaLabel="User bubble colour hex"
                        {...registration}
                      />
                    )}
                  />
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
                          if (current.startsWith("blob:")) {
                            URL.revokeObjectURL(current);
                          }
                          return preview;
                        });
                        try {
                          const body = new FormData();
                          body.append("file", file);
                          const uploaded = await apiFetch<{ logoUrl: string }>(
                            "/api/tenant/lead-channels/logo",
                            { method: "POST", body },
                          );
                          if (uploaded.logoUrl) {
                            form.setValue("logoUrl", uploaded.logoUrl, {
                              shouldDirty: true,
                            });
                            setLogoPreview((current) => {
                              if (current.startsWith("blob:")) {
                                URL.revokeObjectURL(current);
                              }
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
                          form.setValue("logoUrl", "", { shouldDirty: true });
                          setLogoPreview((current) => {
                            if (current.startsWith("blob:")) {
                              URL.revokeObjectURL(current);
                            }
                            return "";
                          });
                          toast.success("Logo removed");
                        }}
                      >
                        Remove logo
                      </AsyncButton>
                    ) : null}
                  </div>
                  <RhfField
                    form={form}
                    name="displayName"
                    controlId="lead-display"
                    label="Display name"
                    renderControl={(registration) => (
                      <Input
                        id="lead-display"
                        disabled={!premium}
                        {...registration}
                      />
                    )}
                  />
                  <div className="md:col-span-2">
                    <RhfField
                      form={form}
                      name="welcome"
                      controlId="lead-welcome"
                      label="Welcome line"
                      renderControl={(registration) => (
                        <Input
                          id="lead-welcome"
                          disabled={!premium}
                          {...registration}
                        />
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <RhfField
                      form={form}
                      name="selectorTitle"
                      controlId="lead-selector-title"
                      label="Selector title"
                      renderControl={(registration) => (
                        <Input
                          id="lead-selector-title"
                          placeholder={defaultSelectorTitle(previewFirm)}
                          disabled={!premium}
                          {...registration}
                        />
                      )}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <RhfField
                      form={form}
                      name="selectorCaption"
                      controlId="lead-selector-caption"
                      label="Selector caption"
                      renderControl={(registration) => (
                        <Input
                          id="lead-selector-caption"
                          placeholder={DEFAULT_SELECTOR_CAPTION}
                          disabled={!premium}
                          {...registration}
                        />
                      )}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!premium}
                    {...form.register("hideCaseyMark")}
                  />
                  Hide the Casey mark
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!premium}
                    {...form.register("hideAvatars")}
                  />
                  Hide avatars
                </label>
                {data?.hostedUrl ? (
                  <p className="text-sm">
                    {hostedLive ? "Live page" : "Address"}:{" "}
                    <a
                      className="underline"
                      href={data.localPath ?? data.hostedUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {data.hostedUrl}
                    </a>
                  </p>
                ) : null}
              </CardContent>
              <CardFooter>
                <AsyncButton type="submit" pendingText="Saving...">
                  Save public intake
                </AsyncButton>
              </CardFooter>
            </form>
          </FormProvider>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead types on the page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(data?.leadTypes ?? []).map((leadType) => {
              const channel = (data?.channels ?? []).find(
                (item) => item.leadTypeId === leadType.id,
              );
              return (
                <div key={leadType.id} className="space-y-1">
                  <p className="text-sm font-medium">{leadType.name}</p>
                  {channel && premium ? (
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
                        {channel.snippet}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Copy snippet"
                        onClick={() => {
                          void navigator.clipboard.writeText(channel.snippet);
                          toast.success("Snippet copied");
                        }}
                      >
                        <CopyIcon />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {channel
                        ? "Upgrade to Growth to embed this on the firm website."
                        : "Not on the hosted page yet."}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <AsyncButton
                      type="button"
                      variant="outline"
                      size="sm"
                      pendingText={
                        channel?.enabled ? "Pausing..." : "Enabling..."
                      }
                      onClick={async () => {
                        const current = form.getValues();
                        const nextAddress = slugifyPublicAddress(
                          current.publicSlug || data?.publicSlug || "",
                        );
                        if (!nextAddress) {
                          throw new Error("Choose a public address first");
                        }
                        await apiFetch("/api/tenant/lead-channels", {
                          method: "POST",
                          body: JSON.stringify({
                            leadTypeId: leadType.id,
                            publicSlug: nextAddress,
                            enabled: channel ? !channel.enabled : true,
                            branding: premium
                              ? brandingFromValues(current)
                              : undefined,
                          }),
                        });
                        await reload();
                        toast.success(
                          channel?.enabled
                            ? "Lead type paused"
                            : "Lead type enabled",
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
            selectorTitle={previewTitle}
            selectorCaption={previewCaption}
            primaryColor={previewHeader}
            textColor={previewText}
            backgroundColor={previewBackground}
            userBubbleColor={previewUserBubble}
            logoUrl={premium ? logoPreview || logoUrl : ""}
            hideCaseyMark={premium && hideCaseyMark}
            hideAvatars={premium && hideAvatars}
            leadTypeNames={enabledLeadTypes.map((leadType) => leadType.name)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
