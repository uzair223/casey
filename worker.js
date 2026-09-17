import handler from "./.open-next/worker.js";

function cronPath(cron) {
  return cron === "0 * * * *"
    ? "/api/internal/reminders/run"
    : "/api/internal/workers/run";
}

const worker = {
  fetch(request, env, ctx) {
    return handler.fetch(request, env, ctx);
  },
  scheduled(controller, env, ctx) {
    const origin = String(env.NEXT_PUBLIC_BASE_URL || "https://internal.casey").replace(
      /\/+$/,
      "",
    );
    const request = new Request(`${origin}${cronPath(controller.cron)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET ?? ""}`,
      },
    });
    ctx.waitUntil(handler.fetch(request, env, ctx));
  },
};

export default worker;

