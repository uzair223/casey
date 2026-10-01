"use client";

import { IntakeSettings } from "@/components/leads/intake-settings";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";

export default function WidgetStudioPage() {
  const { user } = useUserProtected(["tenant_admin", "solicitor", "marketer"]);
  if (!user) return <Loading />;
  return (
    <MarketingFrame
      title="Widget studio"
      description="The public address, the colours, the welcome, and the embed on the firm's website."
    >
      <IntakeSettings />
    </MarketingFrame>
  );
}
