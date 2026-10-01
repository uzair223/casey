"use client";

import { AcquisitionSettings } from "@/components/leads/acquisition-settings";
import Loading from "@/components/loading";
import { PageTitle } from "@/components/page-title";
import { useUserProtected } from "@/contexts/user-context";

export default function MarketerDashboardPage() {
  const { user } = useUserProtected("marketer");

  if (!user) {
    return <Loading />;
  }

  return (
    <section className="space-y-4">
      <PageTitle
        title="Marketing"
        description="The firm's ads, its images, and the website Casey reads."
      />
      <AcquisitionSettings handoff={false} />
    </section>
  );
}
