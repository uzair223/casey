import { notFound } from "next/navigation";

import { HostedLeadChooser } from "@/components/leads/hosted-lead-chooser";
import { listChannelsForSlug } from "@/lib/leads/channels";
import { configuredTurnstileSiteKey } from "@/lib/leads/abuse";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  leadHexColor,
} from "@/lib/leads/schema";
import { attributionFromQuery } from "@/lib/leads/attribution";
import { firmPageUrl } from "@/lib/firm-page-host";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HostedLeadPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const session = typeof query.session === "string" ? query.session : undefined;
  const firm = await listChannelsForSlug(slug);
  if (!firm || firm.channels.length === 0) notFound();
  const incoming = attributionFromQuery(query);
  const attribution = incoming.page ? incoming : { ...incoming, page: firmPageUrl(slug) };

  const backgroundColor = leadHexColor(
    firm.widget ? firm.channels[0]?.branding.backgroundColor : undefined,
    DEFAULT_LEAD_BACKGROUND_COLOR,
  );

  return (
    <main
      className="flex min-h-screen flex-col justify-center"
      style={{ backgroundColor }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-10">
        <HostedLeadChooser
          firmName={firm.tenantName}
          publicKey={firm.channels[0].publicKey}
          welcome={firm.welcome}
          branding={firm.widget ? (firm.channels[0]?.branding ?? {}) : {}}
          turnstileSiteKey={configuredTurnstileSiteKey()}
          resumeToken={session}
          attribution={attribution}
        />
      </div>
    </main>
  );
}
