"use client";

import { useEffect, useState } from "react";

import { AsyncButton } from "@/components/ui/async-button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getTenantNotificationPreferences } from "@/lib/supabase/queries";
import { upsertTenantNotificationPreferences } from "@/lib/supabase/mutations";
import type { TenantNotificationPreferences } from "@/types";

type NotificationChannel = TenantNotificationPreferences["reminders_channel"];
type DigestFrequency = TenantNotificationPreferences["digest_frequency"];

const CHANNEL_OPTIONS: NotificationChannel[] = [
  "email",
  "in_app",
  "both",
  "off",
];
const DIGEST_OPTIONS: DigestFrequency[] = ["off", "daily", "weekly"];

type NotificationPreferencesCardProps = {
  tenantId: string;
  userId: string;
  onStatusChange?: (message: string) => void;
};

export function NotificationPreferencesCard({
  tenantId,
  userId,
  onStatusChange,
}: NotificationPreferencesCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [prefs, setPrefs] = useState<{
    remindersChannel: NotificationChannel;
    followUpRequestsChannel: NotificationChannel;
    submissionsChannel: NotificationChannel;
    mentionChannel: NotificationChannel;
    digestFrequency: DigestFrequency;
  }>({
    remindersChannel: "email",
    followUpRequestsChannel: "email",
    submissionsChannel: "email",
    mentionChannel: "in_app",
    digestFrequency: "daily",
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await getTenantNotificationPreferences(tenantId);
        if (!mounted) return;

        setPrefs({
          remindersChannel: data.reminders_channel,
          followUpRequestsChannel: data.follow_up_requests_channel,
          submissionsChannel: data.submissions_channel,
          mentionChannel: data.mention_channel,
          digestFrequency: data.digest_frequency,
        });
      } catch (error) {
        if (!mounted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load notification preferences";
        onStatusChange?.(message);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [tenantId, onStatusChange]);

  const save = async () => {
    await upsertTenantNotificationPreferences({
      tenantId,
      updatedByUserId: userId,
      remindersChannel: prefs.remindersChannel,
      followUpRequestsChannel: prefs.followUpRequestsChannel,
      submissionsChannel: prefs.submissionsChannel,
      mentionChannel: prefs.mentionChannel,
      digestFrequency: prefs.digestFrequency,
    });

    onStatusChange?.("Notification preferences saved");
  };

  return (
    <Card size="md" className="col-span-2">
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Reminders</p>
          <Select
            value={prefs.remindersChannel}
            onValueChange={(value) =>
              setPrefs((prev) => ({
                ...prev,
                remindersChannel: value as NotificationChannel,
              }))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Follow-up requests</p>
          <Select
            value={prefs.followUpRequestsChannel}
            onValueChange={(value) =>
              setPrefs((prev) => ({
                ...prev,
                followUpRequestsChannel: value as NotificationChannel,
              }))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Submission updates</p>
          <Select
            value={prefs.submissionsChannel}
            onValueChange={(value) =>
              setPrefs((prev) => ({
                ...prev,
                submissionsChannel: value as NotificationChannel,
              }))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Mentions</p>
          <Select
            value={prefs.mentionChannel}
            onValueChange={(value) =>
              setPrefs((prev) => ({
                ...prev,
                mentionChannel: value as NotificationChannel,
              }))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <p className="text-sm font-medium">Digest frequency</p>
          <Select
            value={prefs.digestFrequency}
            onValueChange={(value) =>
              setPrefs((prev) => ({
                ...prev,
                digestFrequency: value as DigestFrequency,
              }))
            }
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIGEST_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <AsyncButton
          onClick={save}
          pendingText="Saving..."
          disabled={isLoading}
        >
          Save notification preferences
        </AsyncButton>
      </CardFooter>
    </Card>
  );
}
