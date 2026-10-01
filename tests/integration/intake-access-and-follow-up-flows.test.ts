import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson } from "./helpers/route-test";

const SERVERONLY_getFullStatementFromToken = vi.fn();
const SERVERONLY_getStatementWithConfigFromToken = vi.fn();
const SERVERONLY_acknowledgeStatementNoticeByToken = vi.fn();
const SERVERONLY_saveConversationMessage = vi.fn();
const SERVERONLY_getConversationHistory = vi.fn();
const getIntakeAccessError = vi.fn();
const enforcePersistentRateLimit = vi.fn();
const getServiceClient = vi.fn();
const loadWitnessChat = vi.fn();
const postWitnessChatMessage = vi.fn();

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getFullStatementFromToken,
  SERVERONLY_getStatementWithConfigFromToken,
  SERVERONLY_getConversationHistory,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_acknowledgeStatementNoticeByToken,
  SERVERONLY_saveConversationMessage,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient,
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

vi.mock("@/lib/api-utils/intake-access", () => ({
  getIntakeAccessError,
}));

vi.mock("@/lib/witness-chat/service", () => ({
  loadWitnessChat,
  postWitnessChatMessage,
}));

describe("intake access and follow-up flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntakeAccessError.mockResolvedValue(null);
    enforcePersistentRateLimit.mockResolvedValue(null);
    getServiceClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({
            data: {
              path: "cases/case-1/statement-1/submitted/follow-up/file-photo.jpg",
            },
            error: null,
          }),
        })),
      },
    });
  });

  it("loads a witness intake payload for a valid token", async () => {
    SERVERONLY_getFullStatementFromToken.mockResolvedValue({
      statement: { status: "in_progress", id: "statement-1" },
      case: { title: "Accident claim" },
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/route")
    >("@/app/api/intake/[token]/route");

    const response = await route.GET(
      new Request("http://localhost/api/intake/token-1"),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson<{ statement: { id: string } }>(response)).resolves
      .toMatchObject({
        statement: { id: "statement-1" },
      });
  });

  it("records privacy notice consent with request metadata", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      status: "draft",
    });
    SERVERONLY_acknowledgeStatementNoticeByToken.mockResolvedValue({
      acknowledged_at: "2026-04-23T12:00:00.000Z",
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/shared/consent/route")
    >("@/app/api/intake/[token]/shared/consent/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/shared/consent", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10, 198.51.100.1",
          "user-agent": "Vitest Browser",
        },
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_acknowledgeStatementNoticeByToken).toHaveBeenCalledWith(
      "token-1",
      {
        ip_address: "203.0.113.10",
        user_agent: "Vitest Browser",
      },
    );
  });

  it("returns the witness chat for a valid intake link", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      tenant_id: "tenant-1",
      case_id: "case-1",
      title: "Accident claim",
      witness_name: "Casey Witness",
      witness_email: "witness@client.test",
      status: "in_progress",
    });
    loadWitnessChat.mockResolvedValue({
      threadId: "thread-1",
      caseTitle: "Accident claim",
      witnessName: "Casey Witness",
      messages: [
        {
          id: "follow-up",
          senderType: "firm",
          senderName: "Casey Solicitor",
          body: "Please clarify the accident time.",
          createdAt: "2026-04-20T10:00:00.000Z",
        },
      ],
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/follow-up/route")
    >("@/app/api/intake/[token]/follow-up/route");

    const response = await route.GET(
      new Request("http://localhost/api/intake/token-1/follow-up"),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson<{ threadId: string }>(response)).resolves.toMatchObject({
      threadId: "thread-1",
      caseTitle: "Accident claim",
    });
    expect(loadWitnessChat).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "statement-1",
        witnessName: "Casey Witness",
      }),
      "witness",
      null,
    );
  });

  it("accepts a follow-up response with uploaded files", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      case_id: "case-1",
      tenant_id: "tenant-1",
      title: "Accident claim",
      witness_name: "Casey Witness",
      witness_email: "witness@client.test",
      status: "in_progress",
    });
    postWitnessChatMessage.mockResolvedValue({ threadId: "thread-1" });
    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/follow-up/route")
    >("@/app/api/intake/[token]/follow-up/route");

    const formData = new FormData();
    formData.append("body", "Here is the missing photograph.");
    formData.append(
      "file_0",
      new File(["image-bytes"], "photo.jpg", { type: "image/jpeg" }),
    );

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/follow-up", {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    expect(postWitnessChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Here is the missing photograph.",
        attachments: [
          expect.objectContaining({
            name: "photo.jpg",
            path: "cases/case-1/statement-1/submitted/follow-up/file-photo.jpg",
            bucketId: "tenant-1",
            type: "image/jpeg",
          }),
        ],
      }),
    );
  });
});
