"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/contexts/user-context";

const roleRoutes: Record<string, string> = {
  app_admin: "/dashboard/app-admin",
  tenant_admin: "/dashboard/tenant-admin",
  solicitor: "/dashboard/solicitor",
  paralegal: "/dashboard/paralegal",
};

function DashboardRouterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useUser();

  const queryString = searchParams.toString();

  useEffect(() => {
    if (isLoading) return;

    // Redirect to auth if no user, no role, or role is "user" (not set up yet)
    if (!user || !user.role || !roleRoutes[user.role]) {
      router.replace("/auth");
      return;
    }

    // If user has no tenant_id and is not app_admin, redirect to auth to accept invite
    if (!user.tenant_id && user.role !== "app_admin") {
      router.replace("/auth");
      return;
    }

    const target = queryString
      ? `${roleRoutes[user.role]}?${queryString}`
      : roleRoutes[user.role];
    router.replace(target);
  }, [user, isLoading, router, queryString]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">
        {isLoading ? "Loading your dashboard..." : "Redirecting..."}
      </p>
    </div>
  );
}

export default function DashboardRouterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      }
    >
      <DashboardRouterPageContent />
    </Suspense>
  );
}
