import { env } from "@/lib/env";
import { Axiom } from "@axiomhq/js";
import { sanitizeForLogging } from "@/lib/observability/sanitize";

type LogLevel = "debug" | "info" | "warn" | "error";

type ServerLogPayload = Record<string, unknown>;

const AXIOM_FLUSH_TIMEOUT_MS = 350;

let axiomClient: Axiom | null = null;

function getAxiomClient(): Axiom | null {
  if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) {
    return null;
  }

  if (!axiomClient) {
    axiomClient = new Axiom({ token: env.AXIOM_TOKEN });
  }

  return axiomClient;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Axiom flush timed out"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function writeConsole(level: LogLevel, event: string, record: object): void {
  const message = `[${event}]`;
  if (level === "error") {
    console.error(message, record);
    return;
  }

  if (level === "warn") {
    console.warn(message, record);
    return;
  }

  console.info(message, record);
}

export async function logServerEvent(
  level: LogLevel,
  event: string,
  payload: ServerLogPayload = {},
): Promise<void> {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    payload: sanitizeForLogging(payload),
  };

  writeConsole(level, event, record);

  const client = getAxiomClient();
  if (!client || !env.AXIOM_DATASET) {
    return;
  }

  try {
    client.ingest(env.AXIOM_DATASET, [record]);
    void withTimeout(client.flush(), AXIOM_FLUSH_TIMEOUT_MS).catch((error) => {
      console.error("[axiom.flush.failed]", sanitizeForLogging(error));
    });
  } catch (error) {
    console.error("[axiom.ingest.failed]", sanitizeForLogging(error));
  }
}
