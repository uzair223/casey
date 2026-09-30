"use client";

import { useEffect, useRef, useState } from "react";

import { SelectorChoice } from "@/components/leads/selector-choice";
import { Button } from "@/components/ui/button";
import { PublicLeadChat } from "@/components/leads/public-lead-chat";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  DEFAULT_LEAD_HEADER_COLOR,
  DEFAULT_LEAD_TEXT_COLOR,
  DEFAULT_SELECTOR_CAPTION,
  defaultSelectorTitle,
  leadHexColor,
  selectorCopy,
  type LeadBranding,
} from "@/lib/leads/schema";

type HostedChannel = {
  publicKey: string;
  leadTypeName: string;
  welcome: string;
  branding: LeadBranding;
};

export function HostedLeadChooser({
  firmName,
  widget,
  channels,
  turnstileSiteKey,
  resumeToken,
}: {
  firmName: string;
  widget: boolean;
  channels: HostedChannel[];
  turnstileSiteKey?: string;
  resumeToken?: string;
}) {
  const [publicKey, setPublicKey] = useState(
    channels.length === 1 ? channels[0].publicKey : null,
  );
  const [linkedToken, setLinkedToken] = useState(
    channels.length === 1 ? resumeToken : undefined,
  );
  const [openingResume, setOpeningResume] = useState(
    Boolean(resumeToken) && channels.length > 1,
  );
  const channelsRef = useRef(channels);
  const channelKeys = channels.map((channel) => channel.publicKey).join(",");

  useEffect(() => {
    channelsRef.current = channels;
  });

  useEffect(() => {
    if (!resumeToken || channelsRef.current.length < 2) return;
    let cancelled = false;
    void fetch(`/api/public/qualify/session/${resumeToken}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { publicKey?: string };
      })
      .then((payload) => {
        if (cancelled) return;
        const match = channelsRef.current.find(
          (channel) => channel.publicKey === payload?.publicKey,
        );
        if (match) {
          setPublicKey(match.publicKey);
          setLinkedToken(resumeToken);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setOpeningResume(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resumeToken, channelKeys]);
  const selected = channels.find((channel) => channel.publicKey === publicKey);
  const firmBranding = widget ? (channels[0]?.branding ?? {}) : {};
  const textColor = leadHexColor(firmBranding.textColor, DEFAULT_LEAD_TEXT_COLOR);
  const primaryColor = leadHexColor(
    firmBranding.primaryColor,
    DEFAULT_LEAD_HEADER_COLOR,
  );

  if (openingResume) {
    return (
      <p className="text-sm" style={{ color: textColor }}>
        Opening your chat…
      </p>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        {firmBranding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firmBranding.logoUrl}
            alt=""
            className="h-12 w-12 rounded bg-white object-contain"
          />
        ) : null}
        <div className="space-y-1">
          <h1 className="text-xl font-medium" style={{ color: textColor }}>
            {selectorCopy(
              firmBranding.selectorTitle,
              defaultSelectorTitle(firmName),
            )}
          </h1>
          <p className="text-sm" style={{ color: textColor }}>
            {selectorCopy(firmBranding.selectorCaption, DEFAULT_SELECTOR_CAPTION)}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {channels.map((channel) => (
            <SelectorChoice
              key={channel.publicKey}
              primaryColor={primaryColor}
              textColor={textColor}
              onClick={() => setPublicKey(channel.publicKey)}
            >
              {channel.leadTypeName}
            </SelectorChoice>
          ))}
        </div>
      </div>
    );
  }

  const chatBackground = leadHexColor(
    widget ? selected.branding.backgroundColor : undefined,
    DEFAULT_LEAD_BACKGROUND_COLOR,
  );

  return (
    <div
      className="fixed inset-0 z-20 flex h-dvh min-h-0 flex-col"
      style={{ backgroundColor: chatBackground }}
    >
      {channels.length > 1 ? (
        <div className="shrink-0 px-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            style={{ color: textColor }}
            onClick={() => setPublicKey(null)}
          >
            Choose a different enquiry
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <PublicLeadChat
          key={selected.publicKey}
          publicKey={selected.publicKey}
          firmName={widget ? selected.branding.displayName || firmName : firmName}
          enquiryName={selected.leadTypeName}
          welcome={selected.welcome}
          branding={widget ? selected.branding : {}}
          turnstileSiteKey={turnstileSiteKey}
          resumeToken={linkedToken}
          fill
          hideFullscreen
        />
      </div>
    </div>
  );
}
