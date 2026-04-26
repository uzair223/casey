import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson } from "./helpers/route-test";

const requireTenantUser = vi.fn();
const getServiceClient = vi.fn();
const SERVERONLY_getStatementForSendLink = vi.fn();
const SERVERONLY_getStatementSubmissionNotificationRecipients = vi.fn();
const SERVERONLY_saveConversationMessage = vi.fn();
const SERVERONLY_createUserNotifications = vi.fn();
const SERVERONLY_updateStatementStatus = vi.fn();
const sendStatementLinkEmail = vi.fn();
const sendStatementFollowUpRequestEmail = vi.fn();
const sendStatementFinalReviewRequestEmail = vi.fn();
const sendStatementReminderEmail = vi.fn();
const logAuditEvent = vi.fn();
const enforcePersistentRateLimit = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_BASE_URL: "https://casey.test",
    CRON_SECRET: "cron-secret",
  },
}));

vi.mock("@/lib/api-utils/auth", () => ({
  requireTenantUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient,
}));

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getStatementForSendLink,
  SERVERONLY_getStatementSubmissionNotificationRecipients,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_saveConversationMessage,
  SERVERONLY_createUserNotifications,
  SERVERONLY_updateStatementStatus,
}));

vi.mock("@/lib/email", () => ({
  sendStatementLinkEmail,
  sendStatementFollowUpRequestEmail,
  sendStatementFinalReviewRequestEmail,
  sendStatementReminderEmail,
}));

vi.mock("@/lib/observability/audit", () => ({
  logAuditEvent,
}));

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>(
    "@/lib/api-utils",
  );
  return {
    ...actual,
    enforcePersistentRateLimit,
  };
});

function createAwaitableBuilder(result: unknown) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then(onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  return builder;
}

describe("statement operation flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforcePersistentRateLimit.mockResolvedValue(null);
    requireTenantUser.mockResolvedValue({
      userId: "user-1",
      email: "solicitor@firm.co.uk",
      tenantId: "tenant-1",
      profile: { display_name: "Casey Solicitor" },
    });
  });

  it("emails the witness their intake link", async () => {
    const profiles = createAwaitableBuilder({
      data: { tenant_id: "tenant-1", role: "solicitor" },
      error: null,
    });
    const tenants = createAwaitableBuilder({
      data: { name: "Tenant Alpha" },
      error: null,
    });

    getServiceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") return profiles;
        if (table === "tenants") return tenants;
        throw new Error(`Unexpected table ${table}`);
      }),
    });
    SERVERONLY_getStatementForSendLink.mockResolvedValue({
      token: "magic-token",
      witness_email: "witness@client.test",
      witness_name: "Casey Witness",
      title: "Accident claim",
    });

    const route = await importFresh<
      typeof import("@/app/api/tenant/statement/[id]/send-link/route")
    >("@/app/api/tenant/statement/[id]/send-link/route");

    const response = await route.POST(
      new Request("http://localhost/api/tenant/statement/statement-1/send-link", {
        method: "POST",
        headers: { authorization: "Bearer token-1" },
      }) as never,
      { params: Promise.resolve({ id: "statement-1" }) },
    );

    expect(response.status).toBe(200);
    expect(sendStatementLinkEmail).toHaveBeenCalledWith({
      to: "witness@client.test",
      tenantName: "Tenant Alpha",
      witnessName: "Casey Witness",
      caseTitle: "Accident claim",
      statementUrl: "https://casey.test/intake/magic-token",
    });
  });

  it("sends a follow-up request and records the event", async () => {
    SERVERONLY_getStatementForSendLink.mockResolvedValue({
      token: "magic-token",
      witness_email: "witness@client.test",
      witness_name: "Casey Witness",
      title: "Accident claim",
    });

    const tenants = createAwaitableBuilder({
      data: { name: "Tenant Alpha" },
      error: null,
    });
    const reminderEvents = createAwaitableBuilder({ error: null });

    getServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "tenants") return tenants;
        if (table === "statement_reminder_events") return reminderEvents;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const route = await importFresh<
      typeof import("@/app/api/tenant/statement/[id]/request-follow-up/route")
    >("@/app/api/tenant/statement/[id]/request-follow-up/route");

    const response = await route.POST(
      new Request(
        "http://localhost/api/tenant/statement/statement-1/request-follow-up",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Please upload the site photographs." }),
        },
      ) as never,
      { params: Promise.resolve({ id: "statement-1" }) },
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_saveConversationMessage).toHaveBeenCalledWith(
      "statement-1",
      "assistant",
      "Please upload the site photographs.",
      expect.objectContaining({
        followUpRequest: true,
        requestedBy: "Casey Solicitor",
      }),
    );
    expect(sendStatementFollowUpRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        statementUrl: "https://casey.test/intake/magic-token/follow-up",
      }),
    );
  });

  it("sends final review to the witness and notifies colleagues", async () => {
    SERVERONLY_getStatementForSendLink.mockResolvedValue({
      token: "magic-token",
      witness_email: "witness@client.test",
      witness_name: "Casey Witness",
      title: "Accident claim",
    });
    SERVERONLY_getStatementSubmissionNotificationRecipients.mockResolvedValue({
      recipientUserIds: ["user-1", "user-2"],
      statementTitle: "Accident claim",
      caseId: "case-1",
    });

    const statements = createAwaitableBuilder({
      data: { status: "submitted" },
      error: null,
    });
    const tenants = createAwaitableBuilder({
      data: { name: "Tenant Alpha" },
      error: null,
    });
    const preferences = createAwaitableBuilder({
      data: { submissions_channel: "both" },
      error: null,
    });

    getServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "statements") return statements;
        if (table === "tenants") return tenants;
        if (table === "tenant_notification_preferences") return preferences;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const route = await importFresh<
      typeof import("@/app/api/tenant/statement/[id]/send-final-review/route")
    >("@/app/api/tenant/statement/[id]/send-final-review/route");

    const response = await route.POST(
      new Request(
        "http://localhost/api/tenant/statement/statement-1/send-final-review",
        { method: "POST" },
      ) as never,
      { params: Promise.resolve({ id: "statement-1" }) },
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_updateStatementStatus).toHaveBeenCalledWith(
      "statement-1",
      "finalized",
    );
    expect(SERVERONLY_createUserNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: "statement_final_review_requested",
        recipientUserIds: ["user-2"],
      }),
    );
    expect(sendStatementFinalReviewRequestEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewUrl: "https://casey.test/intake/magic-token/final-review",
      }),
    );
  });

  it("runs due reminder rules and dispatches email reminders", async () => {
    const dueRules = createAwaitableBuilder({
      data: [
        {
          id: "rule-1",
          tenant_id: "tenant-1",
          statement_id: "statement-1",
          cadence_days: 3,
          max_reminders: 2,
          reminders_sent_count: 0,
        },
      ],
      error: null,
    });
    const statements = createAwaitableBuilder({
      data: [
        {
          id: "statement-1",
          status: "in_progress",
          title: "Accident claim",
          witness_name: "Casey Witness",
          witness_email: "witness@client.test",
        },
      ],
      error: null,
    });
    const tenants = createAwaitableBuilder({
      data: [{ id: "tenant-1", name: "Tenant Alpha" }],
      error: null,
    });
    const preferences = createAwaitableBuilder({
      data: [{ tenant_id: "tenant-1", reminders_channel: "email" }],
      error: null,
    });
    const links = createAwaitableBuilder({
      data: [
        {
          statement_id: "statement-1",
          token: "magic-token",
          expires_at: "2099-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const reminderEvents = createAwaitableBuilder({ error: null });
    const reminderRules = createAwaitableBuilder({ error: null });

    getServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "statement_reminder_rules") {
          return dueRules;
        }
        if (table === "statements") {
          return statements;
        }
        if (table === "tenants") {
          return tenants;
        }
        if (table === "tenant_notification_preferences") {
          return preferences;
        }
        if (table === "magic_links") {
          return links;
        }
        if (table === "statement_reminder_events") {
          return reminderEvents;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    dueRules.update = reminderRules.update;
    dueRules.eq = reminderRules.eq;

    const route = await importFresh<
      typeof import("@/app/api/internal/reminders/run/route")
    >("@/app/api/internal/reminders/run/route");

    const response = await route.POST(
      new Request("http://localhost/api/internal/reminders/run", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 10 }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(sendStatementReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        statementUrl: "https://casey.test/intake/magic-token",
        to: "witness@client.test",
      }),
    );
    await expect(
      readJson<{ processed: number; sent: number; failed: number }>(response),
    ).resolves.toEqual(
      expect.objectContaining({
        processed: 1,
        sent: 1,
        failed: 0,
      }),
    );
  });
});
