import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { logEdgeAxiomEvent } from "@/lib/observability/edge-axiom";

function redactSensitivePath(pathname: string) {
  return pathname
    .replace(
      /^\/api\/intake\/[^/]+/,
      "/api/intake/[redacted-token]",
    )
    .replace(
      /^\/api\/invites\/accept\/[^/]+/,
      "/api/invites/accept/[redacted-token]",
    );
}

function redactSensitiveQuery(search: string) {
  if (!search) {
    return "";
  }

  const params = new URLSearchParams(search);
  for (const key of Array.from(params.keys())) {
    if (key.toLowerCase().includes("token")) {
      params.set(key, "[REDACTED]");
    }
  }

  const redacted = params.toString();
  return redacted ? `?${redacted}` : "";
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();

  response.headers.set("x-request-id", requestId);

  event.waitUntil(
    logEdgeAxiomEvent("info", "api.request.received", {
      requestId,
      method: request.method,
      path: redactSensitivePath(request.nextUrl.pathname),
      query: redactSensitiveQuery(request.nextUrl.search),
      host: request.nextUrl.host,
      userAgent: request.headers.get("user-agent") ?? "unknown",
      ip:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "unknown",
    }),
  );

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
