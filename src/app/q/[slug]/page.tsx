import { notFound } from "next/navigation";

import { HostedLeadChooser } from "@/components/leads/hosted-lead-chooser";
import { listChannelsForSlug } from "@/lib/leads/channels";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  leadHexColor,
} from "@/lib/leads/schema";

type PageProps = { params: Promise<{ slug: string }> };

export default async function HostedLeadPage({ params }: PageProps) {
  const { slug } = await params;
  const firm = await listChannelsForSlug(slug);
  if (!firm || firm.channels.length === 0) notFound();

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
          widget={firm.widget}
          channels={firm.channels.map((channel) => ({
            publicKey: channel.publicKey,
            leadTypeName: channel.leadTypeName,
            branding: channel.branding,
          }))}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        />
      </div>
    </main>
  );
}
