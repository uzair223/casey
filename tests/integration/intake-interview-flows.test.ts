import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson, readText } from "./helpers/route-test";

const chatCompletionsCreate = vi.fn();
const SERVERONLY_getFullStatementFromToken = vi.fn();
const SERVERONLY_getStatementWithConfigFromToken = vi.fn();
const SERVERONLY_getConversationHistory = vi.fn();
const downloadUploadedDocument = vi.fn();
const SERVERONLY_saveConversationMessage = vi.fn();
const getServiceClient = vi.fn();
const getIntakeAccessError = vi.fn();
const logServerEvent = vi.fn();
const generateGreeting = vi.fn();
const getMissingWitnessFieldLabels = vi.fn();
const generateChatSystemPrompt = vi.fn();
const generateFormalizeSystemPrompt = vi.fn();
const getOpenRouterClientOptions = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: chatCompletionsCreate,
      },
    };
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodResponseFormat: vi.fn(() => ({ type: "json_schema" })),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn(),
  };
});

vi.mock("@/lib/env", () => ({
  env: {
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_MODEL: "openai/gpt-4o-mini",
    FORMALIZE_MAX_USER_TURNS: 40,
    FORMALIZE_MAX_CHARS_PER_TURN: 1200,
    FORMALIZE_TIMEOUT_MS: 1000,
    FORMALIZE_MAX_ATTEMPTS: 2,
  },
}));

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getFullStatementFromToken,
  SERVERONLY_getStatementWithConfigFromToken,
  SERVERONLY_getConversationHistory,
  downloadUploadedDocument,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_saveConversationMessage,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient,
}));

vi.mock("@/lib/api-utils/intake-access", () => ({
  getIntakeAccessError,
}));

vi.mock("@/lib/observability/logger", () => ({
  logServerEvent,
}));

vi.mock("@/lib/llm/prompts", () => ({
  generateGreeting,
  getMissingWitnessFieldLabels,
  generateChatSystemPrompt,
  generateFormalizeSystemPrompt,
}));

vi.mock("@/lib/utils", () => ({
  getOpenRouterClientOptions,
}));

describe("intake interview flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntakeAccessError.mockResolvedValue(null);
    SERVERONLY_getConversationHistory.mockResolvedValue([
      {
        role: "assistant",
        content: "What happened?",
      },
      {
        role: "user",
        content: "I was hit by the barrier.",
      },
    ]);
    downloadUploadedDocument.mockResolvedValue(
      new Blob(["Repair estimate total £4,115."], { type: "text/plain" }),
    );
    generateGreeting.mockReturnValue([
      { role: "assistant", content: "Welcome." },
      { role: "assistant", content: "What happened?" },
    ]);
    getMissingWitnessFieldLabels.mockReturnValue({
      required: ["address"],
      optional: ["date of birth"],
    });
    getServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })),
    });
  });

  it("falls back to the built-in greeting when no LLM key is configured", async () => {
    getMissingWitnessFieldLabels.mockReturnValue({
      required: [],
      optional: [],
    });
    SERVERONLY_getFullStatementFromToken.mockResolvedValue({
      case: { title: "Accident claim" },
      statement: { status: "draft" },
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/greeting/route")
    >("@/app/api/intake/[token]/interview/greeting/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/interview/greeting", {
        method: "POST",
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson<Array<{ content: string }>>(response)).resolves.toEqual(
      [
        { role: "assistant", content: "Welcome." },
        { role: "assistant", content: "What happened?" },
      ],
    );
    expect(chatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("blocks interview chat until the privacy notice is acknowledged", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      status: "draft",
      gdpr_notice_acknowledgement: null,
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/chat/route")
    >("@/app/api/intake/[token]/interview/chat/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/interview/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: "I was hit by a barrier.",
          conversationHistory: [],
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(409);
    await expect(readText(response)).resolves.toContain(
      "Please review and accept the privacy notice",
    );
  });

  it("avoids duplicating assistant transcript saves", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      status: "in_progress",
    });

    const existingLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "message-1" },
        error: null,
      }),
    };

    getServiceClient.mockReturnValue({
      from: vi.fn(() => existingLookup),
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/chat/save/route")
    >("@/app/api/intake/[token]/interview/chat/save/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/interview/chat/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: "Please tell me what happened next.",
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_saveConversationMessage).not.toHaveBeenCalled();
  });

  it("formalizes responses and injects missing evidence into the evidence section", async () => {
    const pendingJob = {
      id: "job-1",
      status: "queued",
      created_at: "2026-04-23T12:00:00.000Z",
    };
    const existingJobLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: pendingJob, error: null }),
    };
    getServiceClient.mockReturnValue({
      from: vi.fn(() => existingJobLookup),
    });
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      tenant_id: "tenant-1",
      witness_name: "Casey Witness",
      status: "in_progress",
      supporting_documents: [
        {
          bucketId: "tenant-1",
          name: "photo-1.txt",
          path: "cases/case-1/statement-1/evidence/photo-1.txt",
          type: "text/plain",
          uploadedAt: "2026-04-23T12:00:00.000Z",
        },
      ],
      statement_config: {
        sections: [
          { id: "background", title: "Background" },
          { id: "supportingEvidence", title: "Supporting Evidence" },
        ],
      },
    });
    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/formalize/route")
    >("@/app/api/intake/[token]/interview/formalize/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/interview/formalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: [
            { role: "assistant", content: "What happened?" },
            { role: "user", content: "I was hit by the barrier." },
          ],
          evidence: [
            {
              exhibit: "Photo 1",
              description: "Barrier and shoulder injury",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(202);
    expect(existingJobLookup.insert).toHaveBeenCalledWith({
      tenant_id: "tenant-1",
      kind: "statement_formalization",
      target_id: "statement-1",
      status: "queued",
      request_payload: {
        requestId: expect.any(String),
        tokenSuffix: "oken-1",
      },
    });
    await expect(readJson<typeof pendingJob>(response)).resolves.toEqual({
      id: "job-1",
      status: "queued",
      created_at: "2026-04-23T12:00:00.000Z",
    });
  });

  it("passes uploaded evidence text into the formalization prompt", async () => {
    const existingJob = {
      id: "job-existing",
      status: "running",
      created_at: "2026-04-23T12:00:00.000Z",
    };
    const existingJobLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: existingJob,
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    getServiceClient.mockReturnValue({
      from: vi.fn(() => existingJobLookup),
    });
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      tenant_id: "tenant-1",
      witness_name: "Casey Witness",
      status: "in_progress",
      supporting_documents: [
        {
          bucketId: "tenant-1",
          name: "repair_quote.txt",
          path: "cases/case-1/statement-1/evidence/repair_quote.txt",
          type: "text/plain",
          uploadedAt: "2026-04-23T12:00:00.000Z",
        },
      ],
      statement_config: {
        sections: [{ id: "damageDetails", title: "Damage Details" }],
      },
    });
    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/formalize/route")
    >("@/app/api/intake/[token]/interview/formalize/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/interview/formalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: [{ role: "user", content: "The front of my car was damaged." }],
          evidence: [
            {
              exhibit: "JR1",
              description: "Repair quote",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(202);
    expect(existingJobLookup.insert).not.toHaveBeenCalled();
    await expect(readJson<typeof existingJob>(response)).resolves.toEqual({
      id: "job-existing",
      status: "running",
      created_at: "2026-04-23T12:00:00.000Z",
    });
  });
});
