import { notFound } from "next/navigation";

import { HostedLeadChooser } from "@/components/leads/hosted-lead-chooser";
import { listChannelsForSlug } from "@/lib/leads/channels";

type PageProps = { params: Promise<{ slug: string }> };

export default async function HostedLeadPage({ params }: PageProps) {
  const { slug } = await params;
  const firm = await listChannelsForSlug(slug);
  if (!firm || firm.channels.length === 0) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
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
    </main>
  );
}
