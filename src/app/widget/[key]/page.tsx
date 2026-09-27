import { notFound } from "next/navigation";

import { PublicLeadChat } from "@/components/leads/public-lead-chat";
import { getChannelByKey } from "@/lib/leads/channels";
import { configuredTurnstileSiteKey } from "@/lib/leads/abuse";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  leadHexColor,
} from "@/lib/leads/schema";

type PageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ session?: string }>;
};

export default async function WidgetPage({ params, searchParams }: PageProps) {
  const { key } = await params;
  const { session } = await searchParams;
  const channel = await getChannelByKey(key);
  if (!channel) notFound();

  if (!channel.widget) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          The website widget is part of Growth. The hosted page stays available.
        </p>
      </main>
    );
  }

  return (
    <main
      className="h-dvh"
      style={{
        backgroundColor: leadHexColor(
          channel.branding.backgroundColor,
          DEFAULT_LEAD_BACKGROUND_COLOR,
        ),
      }}
    >
      <PublicLeadChat
        publicKey={channel.publicKey}
        firmName={channel.tenantName}
        enquiryName={channel.leadTypeName}
        welcome={channel.welcome}
        branding={channel.branding}
        turnstileSiteKey={configuredTurnstileSiteKey()}
        resumeToken={session}
        fill
      />
    </main>
  );
}
