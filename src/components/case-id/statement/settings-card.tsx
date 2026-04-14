"use client";

import { useState } from "react";

import { useUser } from "@/contexts/user-context";
import { useAsync } from "@/hooks/useAsync";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  getStatementReminderEvents,
  getStatementReminderRule,
} from "@/lib/supabase/queries";
import { upsertStatementReminderRule } from "@/lib/supabase/mutations";

type StatementReminderSettingsCardProps = {
  tenantId: string;
  statementId: string;
  statementStatus: string;
};

export function StatementReminderSettingsCard({
  tenantId,
  statementId,
  statementStatus,
}: StatementReminderSettingsCardProps) {
  const { user } = useUser();
  const [draft, setDraft] = useState<{
    isEnabled: boolean;
    cadenceDays: string;
    maxReminders: string;
  } | null>(null);

  const { data: rule, handler: refreshRule } = useAsync(
    async () => getStatementReminderRule(statementId),
    [statementId],
    { withUseEffect: true, initialState: null },
  );

  const { data: events, handler: refreshEvents } = useAsync(
    async () => getStatementReminderEvents(statementId, 10),
    [statementId],
    { withUseEffect: true, initialState: [] },
  );

  const formValues = draft ?? {
    isEnabled: rule?.is_enabled ?? true,
    cadenceDays: String(rule?.cadence_days ?? 3),
    maxReminders:
      typeof rule?.max_reminders === "number" ? String(rule.max_reminders) : "",
  };

  const isClosed =
    statementStatus === "submitted" || statementStatus === "locked";

  const saveRule = async () => {
    if (!user?.id) return;

    const cadence = Number(formValues.cadenceDays);
    if (!Number.isInteger(cadence) || cadence < 1) {
      throw new Error("Cadence must be at least 1 day");
    }

    const max =
      formValues.maxReminders.trim() === ""
        ? null
        : Number(formValues.maxReminders);
    if (max !== null && (!Number.isInteger(max) || max < 1)) {
      throw new Error("Max reminders must be empty or >= 1");
    }

    const baseDate = rule?.next_send_at
      ? new Date(rule.next_send_at)
      : new Date();
    const nextSendAt = formValues.isEnabled
      ? new Date(
          baseDate.getTime() + cadence * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;

    await upsertStatementReminderRule({
      tenantId,
      statementId,
      createdByUserId: user.id,
      isEnabled: formValues.isEnabled && !isClosed,
      cadenceDays: cadence,
      maxReminders: max,
      nextSendAt,
    });

    await Promise.all([refreshRule(), refreshEvents()]);
    setDraft(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reminder settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formValues.isEnabled && !isClosed}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...(prev ?? formValues),
                  isEnabled: event.target.checked,
                }))
              }
              disabled={isClosed}
            />
            Enable reminders
          </label>

          <div className="space-y-1">
            <Label>Cadence (days)</Label>
            <Input
              type="number"
              min={1}
              value={formValues.cadenceDays}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...(prev ?? formValues),
                  cadenceDays: event.target.value,
                }))
              }
              disabled={isClosed}
            />
          </div>

          <div className="space-y-1">
            <Label>Max reminders (optional)</Label>
            <Input
              type="number"
              min={1}
              value={formValues.maxReminders}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...(prev ?? formValues),
                  maxReminders: event.target.value,
                }))
              }
              disabled={isClosed}
            />
          </div>
        </div>

        {isClosed ? (
          <p className="text-xs text-muted-foreground">
            Reminders are disabled because this statement is {statementStatus}.
          </p>
        ) : null}

        <AsyncButton type="button" onClick={saveRule} pendingText="Saving...">
          Save reminder settings
        </AsyncButton>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Recent reminder activity</p>
          {events.length ? (
            events.map((event) => (
              <div key={event.id} className="text-xs text-muted-foreground">
                {event.send_type} • {event.status} •{" "}
                {new Date(event.created_at).toLocaleString()}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No reminder events yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
