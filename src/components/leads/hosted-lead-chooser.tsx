"use client";

import { PublicLeadChat } from "@/components/leads/public-lead-chat";
import type { LeadBranding } from "@/lib/leads/schema";
import type { LeadAttribution } from "@/lib/leads/attribution";

export function HostedLeadChooser({
  firmName,
  publicKey,
  welcome,
  branding,
  turnstileSiteKey,
  resumeToken,
  attribution,
}: {
  firmName: string;
  publicKey: string;
  welcome: string;
  branding: LeadBranding;
  turnstileSiteKey?: string;
  resumeToken?: string;
  attribution?: LeadAttribution;
}) {
  return (
    <div className="fixed inset-0 z-20 flex h-dvh min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <PublicLeadChat
          publicKey={publicKey}
          firmName={branding.displayName || firmName}
          welcome={welcome}
          branding={branding}
          turnstileSiteKey={turnstileSiteKey}
          resumeToken={resumeToken}
          attribution={attribution}
          fill
          hideFullscreen
        />
      </div>
    </div>
  );
}
