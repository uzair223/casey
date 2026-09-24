"use client";

import { IntakeSettings } from "@/components/leads/intake-settings";
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
        description="The hosted enquiry page for this organisation. Colours, the logo, and the welcome line are part of Growth."
        actions={[
          {
            label: "Back to settings",
            href: "/settings",
            variant: "outline",
          },
        ]}
      />
      <IntakeSettings />
    </section>
  );
}
