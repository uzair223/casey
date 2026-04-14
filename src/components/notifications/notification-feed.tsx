"use client";

import Link from "next/link";
import { BellIcon, CheckCheckIcon, ExternalLinkIcon } from "lucide-react";

import { useAsync } from "@/hooks/useAsync";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUserNotifications } from "@/lib/supabase/queries";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/supabase/mutations";

type NotificationFeedProps = {
  limit?: number;
  compact?: boolean;
  showMarkAllRead?: boolean;
  showViewAll?: boolean;
  title?: string;
  description?: string;
  className?: string;
};

export function NotificationFeed({
  limit = 50,
  compact = false,
  showMarkAllRead = true,
  showViewAll = false,
  title = "Notifications",
  description = "Mentions and other activity that matters to you.",
  className,
}: NotificationFeedProps) {
  const {
    data: notifications,
    isLoading,
    handler: refreshNotifications,
  } = useAsync(async () => getCurrentUserNotifications(limit), [limit], {
    initialState: [],
    withUseEffect: true,
  });

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const handleMarkRead = async (notificationId: string) => {
    await markNotificationRead(notificationId);
    await refreshNotifications();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await refreshNotifications();
  };

  return (
    <div className={className ?? "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/80 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BellIcon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{title}</p>
              {unreadCount > 0 ? (
                <Badge variant="secondary">{unreadCount} unread</Badge>
              ) : null}
            </div>
            {!compact ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showViewAll ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/notifications">View all</Link>
            </Button>
          ) : null}
          {showMarkAllRead ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheckIcon className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Loading notifications...
        </p>
      ) : notifications.length ? (
        <div className="space-y-3">
          {notifications.slice(0, limit).map((notification) => (
            <Card
              key={notification.id}
              className={notification.read_at ? "bg-card" : "border-primary/40"}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{notification.title}</p>
                      {notification.read_at ? null : (
                        <Badge variant="secondary">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {notification.body}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={notification.link_path}>
                      Open
                      <ExternalLinkIcon className="h-4 w-4" />
                    </Link>
                  </Button>
                  {notification.read_at ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleMarkRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {compact && notifications.length > limit && showViewAll ? (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/notifications">See more</Link>
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No notifications yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
