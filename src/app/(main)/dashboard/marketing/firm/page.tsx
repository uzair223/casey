"use client";

import { FirmStudio } from "@/components/marketing/firm-studio";
import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";

export default function FirmStudioPage() {
  const { user } = useUserProtected(["tenant_admin", "solicitor", "marketer"]);
  if (!user) return <Loading />;
  return <FirmStudio />;
}
