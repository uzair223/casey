type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
};

export const enforceRateLimit = ({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult => {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      retryAfterMs: windowMs,
    };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - current.windowStart)),
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    ok: true,
    limit,
    remaining: limit - current.count,
    retryAfterMs: Math.max(0, windowMs - (now - current.windowStart)),
  };
};

export const getRateLimitKey = (request: Request, scope: string) => {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  return `${scope}:${ip}`;
};
