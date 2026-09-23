"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PublicLeadChat } from "@/components/leads/public-lead-chat";

type HostedChannel = {
  publicKey: string;
  leadTypeName: string;
  branding: {
    primaryColor?: string;
    logoUrl?: string;
    displayName?: string;
    hideCaseyMark?: boolean;
    welcome?: string;
  };
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

  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">Tell {firmName} what happened</h1>
          <p className="text-sm text-muted-foreground">
            Choose the kind of enquiry, then Casey will ask for the details the firm needs.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {channels.map((channel) => (
            <Button
              key={channel.publicKey}
              type="button"
              variant="outline"
              onClick={() => setPublicKey(channel.publicKey)}
            >
              {channel.leadTypeName}
            </Button>
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
