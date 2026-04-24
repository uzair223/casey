"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserProtected } from "@/contexts/user-context";
import Loading from "@/components/loading";

const roleRoutes: Record<string, string> = {
  app_admin: "/dashboard/app-admin",
  tenant_admin: "/dashboard/tenant-admin",
  solicitor: "/dashboard/solicitor",
  paralegal: "/dashboard/paralegal",
};

function DashboardRouterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useUserProtected(null);

  useEffect(() => {
    if (isLoading || !user || !roleRoutes[user.role]) return;
    const target = roleRoutes[user.role];
    const query = searchParams.toString();
    router.replace(query ? `${target}?${query}` : target);
  }, [user, isLoading, router, searchParams]);

  return <Loading />;
}

export default function DashboardRouterPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardRouterPageContent />
    </Suspense>
  );
}
