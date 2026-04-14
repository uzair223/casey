"use client";

import { useUserProtected } from "@/contexts/user-context";
import { PageTitle } from "@/components/page-title";
import { NotificationFeed } from "@/components/notifications";

export default function NotificationsPage() {
  useUserProtected([
    "app_admin",
    "tenant_admin",
    "solicitor",
    "paralegal",
    "user",
  ]);

  return (
    <section className="space-y-6">
      <PageTitle
        title="Notifications"
        description="Mentions and other activity that matters to you."
      />
      <NotificationFeed />
    </section>
  );
}
