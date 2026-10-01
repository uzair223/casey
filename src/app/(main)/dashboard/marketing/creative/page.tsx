"use client";

import { CreativeStudio } from "@/components/marketing/creative-studio";
import Loading from "@/components/loading";
import { useUserProtected } from "@/contexts/user-context";

export default function CreativeStudioPage() {
  const { user } = useUserProtected(["tenant_admin", "solicitor", "marketer"]);
  if (!user) return <Loading />;
  return <CreativeStudio />;
}
