import { notFound } from "next/navigation";

import { PublicLeadChat } from "@/components/leads/public-lead-chat";
import { listChannelsForSlug } from "@/lib/leads/channels";

type PageProps = { params: Promise<{ slug: string }> };

export default async function HostedLeadPage({ params }: PageProps) {
  const { slug } = await params;
  const firm = await listChannelsForSlug(slug);
  if (!firm || firm.channels.length === 0) notFound();
  const channel = firm.channels[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <PublicLeadChat
        publicKey={channel.publicKey}
        firmName={firm.tenantName}
        welcome={`Tell ${firm.tenantName} what happened. Casey will ask for the details they need.`}
        branding={firm.widget ? channel.branding : {}}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      />
    </main>
  );
}
