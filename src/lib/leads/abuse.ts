import "server-only";

import { enforcePersistentRateLimit } from "@/lib/api-utils/persistent-rate-limit";
import { publicTurnBudget } from "@/lib/billing/plans";

export function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  return (
    forwardedFor.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function verifyTurnstile(token: string | null, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production" && token === "dev-turnstile";
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") {
    body.set("remoteip", ip);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!response.ok) return false;
  const payload = (await response.json()) as { success?: boolean };
  return payload.success === true;
}

export async function enforcePublicTurnBudget(params: {
  request: Request;
  tenantId: string;
  plan: string | null | undefined;
}) {
  return enforcePersistentRateLimit({
    request: params.request,
    scope: "public-qualify-tenant",
    identifier: params.tenantId,
    limit: publicTurnBudget(params.plan),
    windowSeconds: 86_400,
    includeIp: false,
  });
}

export async function enforcePublicIpLimit(
  request: Request,
  scope: "public-qualify-session" | "public-qualify-message",
) {
  return enforcePersistentRateLimit({
    request,
    scope,
    limit: scope === "public-qualify-session" ? 10 : 20,
    windowSeconds: scope === "public-qualify-session" ? 3_600 : 60,
  });
}
