import { notFound } from "next/navigation";

import { PublicLeadChat } from "@/components/leads/public-lead-chat";
import { getChannelByKey } from "@/lib/leads/channels";
import { configuredTurnstileSiteKey } from "@/lib/leads/abuse";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  leadHexColor,
} from "@/lib/leads/schema";
import { attributionFromQuery } from "@/lib/leads/attribution";

type PageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WidgetPage({ params, searchParams }: PageProps) {
  const { key } = await params;
  const query = await searchParams;
  const session = typeof query.session === "string" ? query.session : undefined;
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
        welcome={channel.welcome}
        branding={channel.branding}
        turnstileSiteKey={configuredTurnstileSiteKey()}
        resumeToken={session}
        attribution={attributionFromQuery(query)}
        fill
      />
    </main>
  );
}
