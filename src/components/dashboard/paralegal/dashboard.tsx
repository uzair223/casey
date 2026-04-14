"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTitle } from "@/components/page-title";
import { getRoleLabel } from "@/lib/utils";
import { ParalegalOverviewTab } from "./overview-tab";
import { ParalegalCasesTab } from "./cases-tab";
import { ParalegalActivityTab } from "./activity-tab";
import { useUser } from "@/contexts/user-context";
import { useSearchParams } from "next/navigation";

export function ParalegalDashboard() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={user!.tenant_name}
        title={`${getRoleLabel(user!.role)} Dashboard`}
        description="Track your assigned cases and recent progress."
        actions={[
          {
            label: "Cases",
            href: "/dashboard?tab=cases",
            variant: "outline",
          },
          {
            label: "Settings",
            href: "/settings",
            variant: "outline",
          },
        ]}
      />

      <Tabs className="space-y-4" defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ParalegalOverviewTab />
        </TabsContent>

        <TabsContent value="cases">
          <ParalegalCasesTab />
        </TabsContent>

        <TabsContent value="activity">
          <ParalegalActivityTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
