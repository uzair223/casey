"use client";

import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";
import { TenantRoleDashboard } from "@/components/dashboard/tenant-role";

export default function TenantAdminDashboardPage() {
  const { user } = useUserProtected("tenant_admin");

  if (!user) {
    return <Loading />;
  }

  return <TenantRoleDashboard />;
}
