import { env } from "@/lib/env";
import { unauthorized } from "./response";

export function getCronSecretFromRequest(request: Request): string | null {
  const cronHeader =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-reminder-cron-secret");
  if (cronHeader) {
    return cronHeader;
  }

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function requireCronSecret(request: Request) {
  const expected = env.CRON_SECRET?.trim() || null;
  const provided = getCronSecretFromRequest(request);

  if (!expected || provided !== expected) {
    throw unauthorized("Invalid scheduler secret");
  }
}
