"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserProtected } from "@/contexts/user-context";
import { getRoleLabel } from "@/lib/utils";
import { PageTitle } from "@/components/page-title";
import Loading from "@/components/loading";
import { AppAdminOverviewTab } from "@/components/dashboard/app-admin/overview-tab";
import { AppAdminTenantsTab } from "@/components/dashboard/app-admin/tenants-tab";
import { AppAdminMembersTab } from "@/components/dashboard/app-admin/app-admin-tab";
import { AppAdminWaitlistTab } from "@/components/dashboard/app-admin/waitlist-tab";

export default function AppAdminDashboard() {
  const { user } = useUserProtected("app_admin");

  if (!user) {
    return <Loading />;
  }

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={getRoleLabel(user?.role)}
        title="Admin Dashboard"
        description="View platform statistics and manage tenants and app admins."
        actions={[
          {
            label: "Demo Studio",
            href: "/dashboard/app-admin/demo-studio",
            variant: "outline",
          },
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

      <Tabs className="space-y-2" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="app_admin">App Admin</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AppAdminOverviewTab />
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <AppAdminTenantsTab userId={user.id} />
        </TabsContent>

        <TabsContent value="app_admin" className="space-y-4">
          <AppAdminMembersTab userId={user.id} />
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-4">
          <AppAdminWaitlistTab userId={user.id} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
