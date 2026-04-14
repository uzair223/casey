"use client";

import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";
import { ParalegalDashboard } from "@/components/dashboard/paralegal";

export default function ParalegalDashboardPage() {
  const { user } = useUserProtected("paralegal");

  if (!user) {
    return <Loading />;
  }

  return <ParalegalDashboard />;
}
