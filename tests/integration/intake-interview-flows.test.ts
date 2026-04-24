import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson, readText } from "./helpers/route-test";

const chatCompletionsCreate = vi.fn();
const SERVERONLY_getFullStatementFromToken = vi.fn();
const SERVERONLY_getStatementWithConfigFromToken = vi.fn();
const SERVERONLY_saveConversationMessage = vi.fn();
const getServiceClient = vi.fn();
const getIntakeAccessError = vi.fn();
const logServerEvent = vi.fn();
const generateGreeting = vi.fn();
const getMissingWitnessFieldLabels = vi.fn();
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

vi.mock("@/lib/statement-utils/prompts", () => ({
  generateGreeting,
  getMissingWitnessFieldLabels,
  generateFormalizeSystemPrompt,
}));

vi.mock("@/lib/utils", () => ({
  getOpenRouterClientOptions,
}));

describe("intake interview flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntakeAccessError.mockResolvedValue(null);
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
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      status: "in_progress",
      statement_config: {
        sections: [
          { id: "background", title: "Background" },
          { id: "supportingEvidence", title: "Supporting Evidence" },
        ],
      },
    });
    generateFormalizeSystemPrompt.mockReturnValue("formalize prompt");
    chatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              background: "The witness entered the site at 08:10.",
              supportingEvidence: "Existing references only.",
            }),
          },
        },
      ],
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

    expect(response.status).toBe(200);
    expect(generateFormalizeSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("Photo 1"),
      "No uploaded evidence materials provided.",
    );
    await expect(
      readJson<Record<string, string>>(response),
    ).resolves.toEqual({
      background: "The witness entered the site at 08:10.",
      supportingEvidence:
        "Existing references only.\n\nConfirmed exhibits:\n- Photo 1: Barrier and shoulder injury",
    });
  });

  it("passes uploaded evidence text into the formalization prompt", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      status: "in_progress",
      statement_config: {
        sections: [{ id: "damageDetails", title: "Damage Details" }],
      },
    });
    generateFormalizeSystemPrompt.mockReturnValue("formalize prompt");
    chatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              damageDetails: "Drafted from transcript and uploaded evidence.",
            }),
          },
        },
      ],
    });

    getServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              meta: {
                attachedFiles: [
                  {
                    name: "repair_quote.pdf",
                    type: "application/pdf",
                    handledAs: "text",
                    inlineText:
                      "Repair estimate total £4,115. Front bumper, wing and headlight replacement.",
                  },
                ],
              },
            },
          ],
          error: null,
        }),
      })),
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

    expect(response.status).toBe(200);
    expect(generateFormalizeSystemPrompt).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("JR1"),
      expect.stringContaining("Repair estimate total £4,115"),
    );
  });
});
