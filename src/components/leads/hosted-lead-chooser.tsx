"use client";

import { useState } from "react";

import { SelectorChoice } from "@/components/leads/selector-choice";
import { Button } from "@/components/ui/button";
import { PublicLeadChat } from "@/components/leads/public-lead-chat";
import {
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
  branding: LeadBranding;
};

export function HostedLeadChooser({
  firmName,
  widget,
  channels,
  turnstileSiteKey,
}: {
  firmName: string;
  widget: boolean;
  channels: HostedChannel[];
  turnstileSiteKey?: string;
}) {
  const [publicKey, setPublicKey] = useState(
    channels.length === 1 ? channels[0].publicKey : null,
  );
  const selected = channels.find((channel) => channel.publicKey === publicKey);
  const firmBranding = widget ? (channels[0]?.branding ?? {}) : {};
  const textColor = leadHexColor(firmBranding.textColor, DEFAULT_LEAD_TEXT_COLOR);
  const primaryColor = leadHexColor(
    firmBranding.primaryColor,
    DEFAULT_LEAD_HEADER_COLOR,
  );

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

  return (
    <div className="space-y-3">
      {channels.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPublicKey(null)}
        >
          Choose a different enquiry
        </Button>
      ) : null}
      <PublicLeadChat
        publicKey={selected.publicKey}
        firmName={widget ? selected.branding.displayName || firmName : firmName}
        enquiryName={selected.leadTypeName}
        welcome={
          (widget ? selected.branding.welcome : undefined) ||
          `Tell ${firmName} what happened. Casey will ask for the details they need.`
        }
        branding={widget ? selected.branding : {}}
        turnstileSiteKey={turnstileSiteKey}
      />
    </div>
  );
}
