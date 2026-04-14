"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageTitle } from "@/components/page-title";
import { getRoleLabel } from "@/lib/utils";
import { TenantRoleOverviewTab } from "./overview-tab";
import { TenantRoleCasesTab } from "./cases-tab";
import { TenantRoleTeamTab } from "./team-tab";
import { useUser } from "@/contexts/user-context";
import { TenantRoleActivityTab } from "./activity-tab";
import { useSearchParams } from "next/navigation";

export function TenantRoleDashboard() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={user!.tenant_name}
        title={`${getRoleLabel(user!.role)} Dashboard`}
        description="Track tenant work, manage the team, and review recent activity."
        actions={[
          {
            label: "Case Templates",
            href: "/settings/cases",
            variant: "outline",
          },
          {
            label: "Statement Templates",
            href: "/settings/statements",
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
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TenantRoleOverviewTab />
        </TabsContent>

        <TabsContent value="cases">
          <TenantRoleCasesTab />
        </TabsContent>

        <TabsContent value="team">
          <TenantRoleTeamTab />
        </TabsContent>

        <TabsContent value="activity">
          <TenantRoleActivityTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}
