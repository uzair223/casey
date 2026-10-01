"use client";

import { MarketingHome } from "@/components/marketing/marketing-home";
import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";

const ROLES = ["tenant_admin", "solicitor", "marketer"] as const;

export default function MarketingPage() {
  const { user } = useUserProtected([...ROLES]);
  if (!user) return <Loading />;
  return <MarketingHome />;
}
