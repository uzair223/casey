import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { tooManyRequests } from "./response";

type RateLimitRpcResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
};

type RateLimitRpcClient = {
  rpc: (
    fn: "check_api_rate_limit",
    args: {
      key_param: string;
      limit_param: number;
      window_seconds_param: number;
    },
  ) => Promise<{ data: unknown; error: Error | null }>;
};

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  return (
    forwardedFor.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function parseRateLimitResult(value: unknown): RateLimitRpcResult {
  const result =
    value && typeof value === "object"
      ? (value as Partial<RateLimitRpcResult>)
      : {};

  return {
    ok: result.ok === true,
    limit: typeof result.limit === "number" ? result.limit : 0,
    remaining: typeof result.remaining === "number" ? result.remaining : 0,
    retryAfterMs:
      typeof result.retryAfterMs === "number" ? result.retryAfterMs : 0,
  };
}

export async function enforcePersistentRateLimit({
  request,
  scope,
  identifier,
  limit,
  windowSeconds,
}: {
  request: Request;
  scope: string;
  identifier?: string;
  limit: number;
  windowSeconds: number;
}) {
  const rawKey = `${scope}:${getClientIp(request)}:${identifier ?? ""}`;
  const key = `${scope}:${hashKey(rawKey)}`;
  const supabase = getServiceClient(
    `rate_limit:${scope}`,
  ) as unknown as RateLimitRpcClient;

  const { data, error } = await supabase.rpc("check_api_rate_limit", {
    key_param: key,
    limit_param: limit,
    window_seconds_param: windowSeconds,
  });

  if (error) {
    throw error;
  }

  const result = parseRateLimitResult(data);
  if (result.ok) {
    return null;
  }

  return tooManyRequests(
    `Too many requests. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`,
  );
}
