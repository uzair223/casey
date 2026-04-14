import { NextRequest } from "next/server";

import { logAuditEvent } from "@/lib/audit";
import { ok, serverError, unauthorized } from "@/lib/api-utils/response";
import { sendStatementReminderEmail } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

type DueReminderRule = {
  id: string;
  tenant_id: string;
  statement_id: string;
  cadence_days: number;
  max_reminders: number | null;
  reminders_sent_count: number;
};

type StatementRow = {
  id: string;
  status:
    | "draft"
    | "in_progress"
    | "submitted"
    | "locked"
    | "demo"
    | "demo_published";
  title: string;
  witness_name: string;
  witness_email: string;
};

type TenantRow = {
  id: string;
  name: string;
};

type ReminderPreferenceRow = {
  tenant_id: string;
  reminders_channel: "email" | "in_app" | "both" | "off";
};

type MagicLinkRow = {
  statement_id: string;
  token: string;
  expires_at: string;
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function getSchedulerSecret(request: NextRequest): string | null {
  const fromHeader = request.headers.get("x-reminder-cron-secret");
  if (fromHeader) {
    return fromHeader;
  }

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

function getExpectedSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

function nextSendAtIso(from: Date, cadenceDays: number): string {
  return new Date(from.getTime() + cadenceDays * MS_IN_DAY).toISOString();
}

async function createReminderEvent(input: {
  supabase: ReturnType<typeof getServiceClient>;
  tenantId: string;
  statementId: string;
  reminderRuleId: string;
  status: "sent" | "failed" | "skipped";
  recipientEmail: string | null;
  errorMessage?: string | null;
  metadata?: Json;
}) {
  await input.supabase.from("statement_reminder_events").insert({
    tenant_id: input.tenantId,
    statement_id: input.statementId,
    reminder_rule_id: input.reminderRuleId,
    created_by_user_id: null,
    send_type: "scheduled",
    recipient_email: input.recipientEmail,
    status: input.status,
    error_message: input.errorMessage ?? null,
    metadata: (input.metadata ?? {}) as Json,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  });
}

async function runReminderJob(request: NextRequest) {
  const expectedSecret = getExpectedSecret();
  const providedSecret = getSchedulerSecret(request);

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return unauthorized("Invalid scheduler secret");
  }

  const body = await request.json().catch(() => ({}));
  const batchSize = Math.max(1, Math.min(200, Number(body?.limit ?? 100)));
  const dryRun = Boolean(body?.dryRun);

  const now = new Date();
  const nowIso = now.toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const supabase = getServiceClient("internal_reminders_runner");

  const { data: dueRules, error: dueRulesError } = await supabase
    .from("statement_reminder_rules")
    .select(
      "id, tenant_id, statement_id, cadence_days, max_reminders, reminders_sent_count",
    )
    .eq("is_enabled", true)
    .not("next_send_at", "is", null)
    .lte("next_send_at", nowIso)
    .order("next_send_at", { ascending: true })
    .limit(batchSize);

  if (dueRulesError) {
    throw dueRulesError;
  }

  const rules = (dueRules ?? []) as DueReminderRule[];
  if (!rules.length) {
    return ok({
      ok: true,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      disabled: 0,
      dryRun,
    });
  }

  const statementIds = Array.from(
    new Set(rules.map((rule) => rule.statement_id)),
  );
  const tenantIds = Array.from(new Set(rules.map((rule) => rule.tenant_id)));

  const [statementsRes, tenantsRes, prefsRes, linksRes] = await Promise.all([
    supabase
      .from("statements")
      .select("id, status, title, witness_name, witness_email")
      .in("id", statementIds),
    supabase.from("tenants").select("id, name").in("id", tenantIds),
    supabase
      .from("tenant_notification_preferences")
      .select("tenant_id, reminders_channel")
      .in("tenant_id", tenantIds),
    supabase
      .from("magic_links")
      .select("statement_id, token, expires_at")
      .in("statement_id", statementIds)
      .gte("expires_at", nowIso)
      .order("expires_at", { ascending: false }),
  ]);

  if (statementsRes.error) throw statementsRes.error;
  if (tenantsRes.error) throw tenantsRes.error;
  if (prefsRes.error) throw prefsRes.error;
  if (linksRes.error) throw linksRes.error;

  const statementMap = new Map(
    ((statementsRes.data ?? []) as StatementRow[]).map((item) => [
      item.id,
      item,
    ]),
  );
  const tenantMap = new Map(
    ((tenantsRes.data ?? []) as TenantRow[]).map((item) => [item.id, item]),
  );
  const preferenceMap = new Map(
    ((prefsRes.data ?? []) as ReminderPreferenceRow[]).map((item) => [
      item.tenant_id,
      item.reminders_channel,
    ]),
  );

  const linkMap = new Map<string, MagicLinkRow>();
  for (const link of (linksRes.data ?? []) as MagicLinkRow[]) {
    if (!linkMap.has(link.statement_id)) {
      linkMap.set(link.statement_id, link);
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let disabled = 0;

  for (const rule of rules) {
    const statement = statementMap.get(rule.statement_id);
    const tenant = tenantMap.get(rule.tenant_id);

    if (!statement || !tenant) {
      skipped += 1;
      if (!dryRun) {
        await createReminderEvent({
          supabase,
          tenantId: rule.tenant_id,
          statementId: rule.statement_id,
          reminderRuleId: rule.id,
          status: "skipped",
          recipientEmail: null,
          errorMessage: "Missing statement or tenant",
          metadata: { reason: "missing_dependencies" },
        });
      }
      continue;
    }

    const shouldDisableForStatus =
      statement.status === "submitted" ||
      statement.status === "locked" ||
      statement.status === "demo_published";

    if (shouldDisableForStatus) {
      disabled += 1;
      skipped += 1;

      if (!dryRun) {
        await createReminderEvent({
          supabase,
          tenantId: rule.tenant_id,
          statementId: rule.statement_id,
          reminderRuleId: rule.id,
          status: "skipped",
          recipientEmail: statement.witness_email || null,
          errorMessage: `Statement status is ${statement.status}`,
          metadata: { reason: "terminal_status", status: statement.status },
        });

        await supabase
          .from("statement_reminder_rules")
          .update({ is_enabled: false, next_send_at: null })
          .eq("id", rule.id);
      }

      continue;
    }

    const remindersChannel = preferenceMap.get(rule.tenant_id) ?? "email";
    const maxReached =
      rule.max_reminders !== null &&
      rule.reminders_sent_count >= rule.max_reminders;

    if (maxReached) {
      disabled += 1;
      skipped += 1;

      if (!dryRun) {
        await createReminderEvent({
          supabase,
          tenantId: rule.tenant_id,
          statementId: rule.statement_id,
          reminderRuleId: rule.id,
          status: "skipped",
          recipientEmail: statement.witness_email || null,
          errorMessage: "Maximum reminders reached",
          metadata: { reason: "max_reached" },
        });

        await supabase
          .from("statement_reminder_rules")
          .update({ is_enabled: false, next_send_at: null })
          .eq("id", rule.id);
      }

      continue;
    }

    if (!statement.witness_email) {
      skipped += 1;
      if (!dryRun) {
        await createReminderEvent({
          supabase,
          tenantId: rule.tenant_id,
          statementId: rule.statement_id,
          reminderRuleId: rule.id,
          status: "skipped",
          recipientEmail: null,
          errorMessage: "Witness email not available",
          metadata: { reason: "missing_witness_email" },
        });

        await supabase
          .from("statement_reminder_rules")
          .update({
            next_send_at: nextSendAtIso(now, rule.cadence_days),
          })
          .eq("id", rule.id);
      }
      continue;
    }

    if (remindersChannel === "off" || remindersChannel === "in_app") {
      skipped += 1;
      if (!dryRun) {
        await createReminderEvent({
          supabase,
          tenantId: rule.tenant_id,
          statementId: rule.statement_id,
          reminderRuleId: rule.id,
          status: "skipped",
          recipientEmail: statement.witness_email,
          errorMessage: `Reminder channel is ${remindersChannel}`,
          metadata: { reason: "channel_disabled", remindersChannel },
        });

        await supabase
          .from("statement_reminder_rules")
          .update({
            next_send_at: nextSendAtIso(now, rule.cadence_days),
          })
          .eq("id", rule.id);
      }
      continue;
    }

    const magicLink = linkMap.get(rule.statement_id);
    if (!magicLink?.token) {
      skipped += 1;
      if (!dryRun) {
        await createReminderEvent({
          supabase,
          tenantId: rule.tenant_id,
          statementId: rule.statement_id,
          reminderRuleId: rule.id,
          status: "skipped",
          recipientEmail: statement.witness_email,
          errorMessage: "No active magic link",
          metadata: { reason: "missing_magic_link" },
        });

        await supabase
          .from("statement_reminder_rules")
          .update({
            next_send_at: nextSendAtIso(now, rule.cadence_days),
          })
          .eq("id", rule.id);
      }
      continue;
    }

    if (dryRun) {
      sent += 1;
      continue;
    }

    try {
      const statementUrl = `${baseUrl}/intake/${magicLink.token}`;

      await sendStatementReminderEmail({
        to: statement.witness_email,
        tenantName: tenant.name,
        witnessName: statement.witness_name,
        caseTitle: statement.title,
        statementUrl,
      });

      const nextCount = rule.reminders_sent_count + 1;
      const shouldDisableAfterSend =
        rule.max_reminders !== null && nextCount >= rule.max_reminders;

      await createReminderEvent({
        supabase,
        tenantId: rule.tenant_id,
        statementId: rule.statement_id,
        reminderRuleId: rule.id,
        status: "sent",
        recipientEmail: statement.witness_email,
        metadata: {
          remindersChannel,
          reminderNumber: nextCount,
          maxReminders: rule.max_reminders,
        },
      });

      await supabase
        .from("statement_reminder_rules")
        .update({
          reminders_sent_count: nextCount,
          last_sent_at: nowIso,
          next_send_at: shouldDisableAfterSend
            ? null
            : nextSendAtIso(now, rule.cadence_days),
          is_enabled: !shouldDisableAfterSend,
        })
        .eq("id", rule.id);

      await logAuditEvent({
        tenantId: rule.tenant_id,
        actorUserId: null,
        action: "statement.reminder.sent",
        targetType: "statement",
        targetId: rule.statement_id,
        metadata: {
          reminderRuleId: rule.id,
          recipient: statement.witness_email,
        },
      });

      if (shouldDisableAfterSend) {
        disabled += 1;
      }

      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown error";

      await createReminderEvent({
        supabase,
        tenantId: rule.tenant_id,
        statementId: rule.statement_id,
        reminderRuleId: rule.id,
        status: "failed",
        recipientEmail: statement.witness_email,
        errorMessage: message,
        metadata: { reason: "delivery_failed" },
      });

      await supabase
        .from("statement_reminder_rules")
        .update({
          next_send_at: nextSendAtIso(now, rule.cadence_days),
        })
        .eq("id", rule.id);
    }
  }

  return ok({
    ok: true,
    processed: rules.length,
    sent,
    failed,
    skipped,
    disabled,
    dryRun,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await runReminderJob(request);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await runReminderJob(request);
  } catch (error) {
    return serverError(error);
  }
}
