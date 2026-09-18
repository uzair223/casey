import { env } from "@/lib/env";

const CLOUDFLARE_AI_API_BASE = "https://api.cloudflare.com/client/v4/accounts";

export function isCloudflareAiConfigured() {
  return (
    Boolean(env.CLOUDFLARE_AI_ACCOUNT_ID?.trim()) &&
    Boolean(env.CLOUDFLARE_AI_API_TOKEN?.trim())
  );
}

export function getCloudflareAiGatewayId() {
  return env.CLOUDFLARE_AI_GATEWAY_ID?.trim() || "default";
}

export function getCloudflareAiHeaders() {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.CLOUDFLARE_AI_API_TOKEN}`,
    "Content-Type": "application/json",
    "cf-aig-gateway-id": getCloudflareAiGatewayId(),
  };

  if (env.NEXT_PUBLIC_APP_NAME) {
    headers["X-Title"] = env.NEXT_PUBLIC_APP_NAME;
  }

  return headers;
}

export function getCloudflareAiClientOptions() {
  return {
    apiKey: env.CLOUDFLARE_AI_API_TOKEN,
    baseURL: `${CLOUDFLARE_AI_API_BASE}/${env.CLOUDFLARE_AI_ACCOUNT_ID}/ai/v1`,
    defaultHeaders: {
      "cf-aig-gateway-id": getCloudflareAiGatewayId(),
    },
  };
}

export function getCloudflareAiRunUrl() {
  return `${CLOUDFLARE_AI_API_BASE}/${env.CLOUDFLARE_AI_ACCOUNT_ID}/ai/run`;
}
