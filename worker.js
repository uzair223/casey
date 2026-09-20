import handler from "./.open-next/worker.js";

function cronPath(cron) {
  return cron === "0 * * * *"
    ? "/api/internal/reminders/run"
    : "/api/internal/workers/run";
}

function workerPathForJobKind(kind) {
  if (kind === "case_analysis") {
    return "/api/internal/workers/case-analysis";
  }
  if (kind === "statement_formalization") {
    return "/api/internal/workers/statement-formalization";
  }
  return null;
}

function originFromEnv(env) {
  return String(env.NEXT_PUBLIC_BASE_URL || "https://internal.casey").replace(
    /\/+$/,
    "",
  );
}

function internalRequest(env, path, init = {}) {
  return new Request(`${originFromEnv(env)}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET ?? ""}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    body: init.body,
  });
}

async function runInternal(env, ctx, path, init = {}) {
  const response = await handler.fetch(internalRequest(env, path, init), env, ctx);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`${path} failed: ${response.status} ${details}`);
  }
  return response;
}

const worker = {
  fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    await runInternal(env, ctx, cronPath(controller.cron));
  },
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      const body = message.body ?? {};
      const jobId = body.jobId;
      const path = workerPathForJobKind(body.kind);
      if (typeof jobId !== "string" || !path) {
        console.error("Invalid AI job queue message", body);
        continue;
      }

      await runInternal(env, ctx, path, {
        method: "POST",
        body: JSON.stringify({ jobId }),
      });
    }
  },
};

export default worker;
