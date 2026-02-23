"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

export default function OnboardingPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    // Onboarding is now handled during invite acceptance
    // Redirect users to appropriate destination
    if (!isLoading) {
      if (!user) {
        router.replace("/auth");
      } else if (user.role === "user") {
        router.replace("/auth");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
