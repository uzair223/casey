"use client";

import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";
import { TenantRoleDashboard } from "@/components/dashboard/tenant-role";

export default function SolicitorDashboardPage() {
  const { user } = useUserProtected("solicitor");

  if (!user) {
    return <Loading />;
  }

  return <TenantRoleDashboard />;
}
