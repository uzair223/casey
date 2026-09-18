import "server-only";

import { logServerEvent } from "@/lib/observability/logger";
import {
  getCloudflareAiHeaders,
  getCloudflareAiRunUrl,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";

import type { EntryType, Questions } from "./questions";
import { JEV_MODEL, JEV_TIMEOUT_MS } from "./thresholds";

export { isCloudflareAiConfigured as isJevConfigured };

export type JevResult = {
  model: string;
  answers: Record<string, unknown>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

function toJsonState(state: unknown): EntryType {
  try {
    return JSON.parse(JSON.stringify(state)) as EntryType;
  } catch {
    return null;
  }
}

function readJevResult(payload: unknown): JevResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const envelope = payload as {
    success?: boolean;
    result?: unknown;
    errors?: unknown;
    model?: unknown;
    answers?: unknown;
    usage?: { input_tokens?: unknown; output_tokens?: unknown };
  };

  const body =
    envelope.result && typeof envelope.result === "object"
      ? (envelope.result as typeof envelope)
      : envelope;

  if (!body.answers || typeof body.answers !== "object") {
    return null;
  }

  return {
    model: typeof body.model === "string" ? body.model : JEV_MODEL,
    answers: body.answers as Record<string, unknown>,
    usage: {
      input_tokens:
        typeof body.usage?.input_tokens === "number"
          ? body.usage.input_tokens
          : 0,
      output_tokens:
        typeof body.usage?.output_tokens === "number"
          ? body.usage.output_tokens
          : 0,
    },
  };
}

export async function evaluateWithJev(params: {
  purpose: string;
  state: unknown;
  questions: Questions;
}): Promise<JevResult | null> {
  if (!isCloudflareAiConfigured()) {
    return null;
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(getCloudflareAiRunUrl(), {
      method: "POST",
      headers: getCloudflareAiHeaders(),
      body: JSON.stringify({
        model: JEV_MODEL,
        input: {
          state: toJsonState(params.state),
          questions: params.questions,
        },
      }),
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });

    const payload = (await response.json()) as unknown;
    const result = readJevResult(payload);

    if (!response.ok || !result) {
      throw new Error(
        `Cloudflare Jev request failed (${response.status}).`,
      );
    }

    await logServerEvent("info", "jev.evaluate.succeeded", {
      purpose: params.purpose,
      model: result.model,
      durationMs: Date.now() - startedAt,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      questionCount: Object.keys(params.questions).length,
    });

    return result;
  } catch (error) {
    await logServerEvent("warn", "jev.evaluate.failed", {
      purpose: params.purpose,
      durationMs: Date.now() - startedAt,
      error,
    });
    return null;
  }
}
