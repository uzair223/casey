import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

export type OAuthProvider = "google" | "meta" | "clio";

type OAuthState = {
  tenantId: string;
  provider: OAuthProvider;
  region?: string;
  exp: number;
};

function secret() {
  return env.CRON_SECRET || env.SUPABASE_SECRET_KEY;
}

export function signOAuthState(payload: {
  tenantId: string;
  provider: OAuthProvider;
  region?: string;
}) {
  const key = secret();
  if (!key) throw new Error("Casey cannot start a connection until the server secret is set.");
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 15 * 60 * 1000 } satisfies OAuthState),
  ).toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readOAuthState(state: string | null, provider: OAuthProvider) {
  const key = secret();
  if (!key || !state) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (parsed.provider !== provider || parsed.exp < Date.now() || !parsed.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function oauthRedirect(provider: OAuthProvider) {
  return `${env.NEXT_PUBLIC_BASE_URL}/api/tenant/acquisition/${provider}/callback`;
}

export function intakeRedirect(query: Record<string, string>) {
  const url = new URL("/settings/intake", env.NEXT_PUBLIC_BASE_URL);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
}
