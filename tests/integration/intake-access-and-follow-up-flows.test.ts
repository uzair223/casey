import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson } from "./helpers/route-test";

const SERVERONLY_getFullStatementFromToken = vi.fn();
const SERVERONLY_getStatementWithConfigFromToken = vi.fn();
const SERVERONLY_acknowledgeStatementNoticeByToken = vi.fn();
const SERVERONLY_saveConversationMessage = vi.fn();
const getConversationHistory = vi.fn();
const uploadFile = vi.fn();
const getIntakeAccessError = vi.fn();

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getFullStatementFromToken,
  SERVERONLY_getStatementWithConfigFromToken,
  getConversationHistory,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_acknowledgeStatementNoticeByToken,
  SERVERONLY_saveConversationMessage,
  uploadFile,
}));

vi.mock("@/lib/api-utils/intake-access", () => ({
  getIntakeAccessError,
}));

describe("intake access and follow-up flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntakeAccessError.mockResolvedValue(null);
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

  it("returns the latest follow-up request and only responses after it", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      title: "Accident claim",
      witness_name: "Casey Witness",
      status: "in_progress",
    });
    getConversationHistory.mockResolvedValue([
      {
        id: "older-user",
        role: "user",
        content: "Old answer",
        created_at: "2026-04-20T09:00:00.000Z",
        meta: null,
      },
      {
        id: "follow-up",
        role: "assistant",
        content: "Please clarify the accident time.",
        created_at: "2026-04-20T10:00:00.000Z",
        meta: { followUpRequest: true },
      },
      {
        id: "new-user",
        role: "user",
        content: "It happened at 08:10.",
        created_at: "2026-04-20T11:00:00.000Z",
        meta: null,
      },
    ]);

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/follow-up/route")
    >("@/app/api/intake/[token]/follow-up/route");

    const response = await route.GET(
      new Request("http://localhost/api/intake/token-1/follow-up"),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(
      readJson<{
        followUpRequest: { id: string } | null;
        responses: Array<{ id: string }>;
      }>(response),
    ).resolves.toEqual({
      caseTitle: "Accident claim",
      witnessName: "Casey Witness",
      followUpRequest: {
        id: "follow-up",
        message: "Please clarify the accident time.",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
      responses: [
        {
          id: "new-user",
          message: "It happened at 08:10.",
          createdAt: "2026-04-20T11:00:00.000Z",
        },
      ],
    });
  });

  it("accepts a follow-up response with uploaded files", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      case_id: "case-1",
      tenant_id: "tenant-1",
      status: "in_progress",
    });
    uploadFile.mockResolvedValue({
      name: "photo.jpg",
      path: "statements/case-1/statement-1/follow-up/file-photo.jpg",
      type: "image/jpeg",
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/follow-up/route")
    >("@/app/api/intake/[token]/follow-up/route");

    const formData = new FormData();
    formData.append("response", "Here is the missing photograph.");
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
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(SERVERONLY_saveConversationMessage).toHaveBeenCalledWith(
      "statement-1",
      "user",
      "Here is the missing photograph.",
      expect.objectContaining({
        followUpResponse: true,
        uploadedDocuments: [
          expect.objectContaining({
            name: "photo.jpg",
            path: "statements/case-1/statement-1/follow-up/file-photo.jpg",
            bucketId: "tenant-1",
            type: "image/jpeg",
          }),
        ],
      }),
    );
  });
});
