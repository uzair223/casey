"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

const roleRoutes: Record<string, string> = {
  app_admin: "/dashboard/app-admin",
  tenant_admin: "/dashboard/tenant-admin",
  solicitor: "/dashboard/solicitor",
  paralegal: "/dashboard/paralegal",
};

export default function DashboardRouterPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    console.log("Dashboard - user:", user, "isLoading:", isLoading);

    if (isLoading) return;

    // Redirect to auth if no user, no role, or role is "user" (not set up yet)
    if (!user || !user.role || !roleRoutes[user.role]) {
      console.log("Dashboard - redirecting to auth (no valid user/role)");
      router.replace("/auth");
      return;
    }

    // If user has no tenant_id and is not app_admin, redirect to auth to accept invite
    if (!user.tenant_id && user.role !== "app_admin") {
      console.log("Dashboard - redirecting to auth (no tenant_id)");
      router.replace("/auth");
      return;
    }

    console.log("Dashboard - redirecting to role page:", roleRoutes[user.role]);
    router.replace(roleRoutes[user.role]);
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {isLoading ? "Loading your dashboard..." : "Redirecting..."}
      </p>
    </div>
  );
}
