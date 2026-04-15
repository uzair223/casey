import { logServerEvent } from "@/lib/observability/logger";

type SupabaseFetchSource = "service-client" | "browser-client";

function toUrl(input: string | URL | Request): URL | null {
  try {
    if (typeof input === "string") {
      return new URL(input);
    }

    if (input instanceof URL) {
      return input;
    }

    return new URL(input.url);
  } catch {
    return null;
  }
}

export function createSupabaseLoggedFetch(
  source: SupabaseFetchSource,
  sourceName?: string,
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const startedAt = Date.now();
    const requestUrl = toUrl(input);
    const method =
      init?.method || (input instanceof Request ? input.method : "GET");

    try {
      const response = await fetch(input, init);
      const durationMs = Date.now() - startedAt;

      await logServerEvent("info", "supabase.request", {
        source,
        sourceName: sourceName ?? null,
        method,
        path: requestUrl?.pathname ?? "unknown",
        query: requestUrl?.search ?? "",
        status: response.status,
        ok: response.ok,
        durationMs,
      });

      if (!response.ok) {
        await logServerEvent("error", "supabase.request.error_response", {
          source,
          sourceName: sourceName ?? null,
          method,
          path: requestUrl?.pathname ?? "unknown",
          query: requestUrl?.search ?? "",
          status: response.status,
          statusText: response.statusText,
          durationMs,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      await logServerEvent("error", "supabase.request.failed", {
        source,
        sourceName: sourceName ?? null,
        method,
        path: requestUrl?.pathname ?? "unknown",
        query: requestUrl?.search ?? "",
        durationMs,
        error,
      });
      throw error;
    }
  };
}
