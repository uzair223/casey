import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

type RouteModule = {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  PATCH?: RouteHandler;
  DELETE?: RouteHandler;
};

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> },
) => Promise<Response>;

const ROUTES_ROOT = path.join(process.cwd(), "src", "app", "api");
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const paramsFixture: Record<string, string> = {
  id: "test-id",
  token: "test-token",
  statementId: "test-statement-id",
  messageId: "test-message-id",
};

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2ODk2MDAsImV4cCI6MjA1MTI2NTYwMH0.l6L6v9a6j0iIuR8s7T0Y4WwT5yqR5B3E2W8fA0hJ8tA";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTY4OTYwMCwiZXhwIjoyMDUxMjY1NjAwfQ.B7xj4fQv2lYfY8d5yQ2aWb6nK3vZ2mX5tA9dJ4hC1eM";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= LOCAL_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= LOCAL_ANON_KEY;
process.env.SUPABASE_SECRET_KEY ??= LOCAL_SERVICE_ROLE_KEY;
process.env.CRON_SECRET ??= "test-secret";
process.env.RESEND_API_KEY ??= "re_test_key";
process.env.RESEND_FROM ??= "Casey Test <noreply@example.com>";

function isRuntimeCrash(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }

  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(error.message)) {
    return false;
  }

  return (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    /Cannot read|undefined|is not a function|is not iterable/i.test(
      error.message,
    )
  );
}

async function walk(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }

      return entry.isFile() && entry.name === "route.ts" ? [fullPath] : [];
    }),
  );

  return files.flat();
}

function makeRequest(method: string, routeFilePath: string): NextRequest {
  const routePath =
    routeFilePath
      .replace(/\\/g, "/")
      .split("/src/app")
      .at(1)
      ?.replace("/route.ts", "")
      ?.replace(/\[(.+?)\]/g, "$1") || "/api/unknown";

  const url = new URL(routePath, "http://127.0.0.1:3000");
  const hasBody = method !== "GET";

  const request = new Request(url.toString(), {
    method,
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
      "x-reminder-cron-secret": process.env.CRON_SECRET || "test-secret",
    },
    body: hasBody ? JSON.stringify({}) : undefined,
  });

  return new NextRequest(request);
}

describe("API route handlers", () => {
  it("loads and executes all exported HTTP handlers without throwing", async () => {
    const routeFiles = await walk(ROUTES_ROOT);
    expect(routeFiles.length).toBeGreaterThan(0);

    for (const routeFile of routeFiles) {
      const moduleUrl = pathToFileURL(routeFile).href;
      const routeModule = (await import(moduleUrl)) as RouteModule;
      const exportedMethods = HTTP_METHODS.filter(
        (method) => typeof routeModule[method] === "function",
      );

      expect(
        exportedMethods.length,
        `No handlers exported by ${routeFile}`,
      ).toBeGreaterThan(0);

      for (const method of exportedMethods) {
        const handler = routeModule[method];
        if (!handler) {
          continue;
        }

        const request = makeRequest(method, routeFile);
        try {
          const response = await handler(request, { params: paramsFixture });
          expect(response).toBeInstanceOf(Response);
          expect(response.status).toBeGreaterThanOrEqual(100);
          expect(response.status).toBeLessThan(600);
        } catch (error) {
          expect(
            isRuntimeCrash(error),
            `Unexpected runtime crash in ${routeFile} [${method}]: ${String(error)}`,
          ).toBe(false);
        }
      }
    }
  });
});
