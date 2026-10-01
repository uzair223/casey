"use client";

import Link from "next/link";

import { AcquisitionSettings } from "@/components/leads/acquisition-settings";
import Loading from "@/components/loading";
import { PageTitle } from "@/components/page-title";
import { useUserProtected } from "@/contexts/user-context";

export default function PublicIntakeSettingsPage() {
  const { user } = useUserProtected("tenant_admin", { redirectTo: "/settings" });

  if (!user) {
    return <Loading />;
  }

  return (
    <section className="space-y-4">
      <PageTitle
        title="Public intake"
        description="Where an accepted lead is sent. The widget and the ads live in Marketing."
        actions={[
          { label: "Back to settings", href: "/settings", variant: "outline" },
          { label: "Widget studio", href: "/dashboard/marketing/widget", variant: "outline" },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        The enquiry widget, the firm brand, and the ads are in{" "}
        <Link href="/dashboard/marketing" className="underline">
          Marketing
        </Link>
        .
      </p>
      <AcquisitionSettings />
    </section>
  );
}
