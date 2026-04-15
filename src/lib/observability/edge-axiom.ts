import { env } from "@/lib/env";
import { sanitizeForLogging } from "@/lib/observability/sanitize";

export async function logEdgeAxiomEvent(
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>,
) {
  if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) {
    return;
  }

  const url = `${env.AXIOM_BASE_URL}/v1/datasets/${encodeURIComponent(env.AXIOM_DATASET)}/ingest`;
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    payload: sanitizeForLogging(payload),
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([record]),
    });
  } catch {
    // Avoid blocking request handling due to telemetry failures.
  }
}
