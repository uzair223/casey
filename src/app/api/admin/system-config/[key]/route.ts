import { NextResponse } from "next/server";
import {
  getSystemConfig,
  isSystemConfigKey,
  setSystemConfig,
} from "@/lib/supabase/system-config";
import { logServerEvent } from "@/lib/observability/logger";
import { requireAppAdmin } from "@/lib/api-utils/auth";
import { randomUUID } from "crypto";

const SECRET_CONFIG_KEYS = new Set(["cron_secret"]);

function serializeConfigValue(key: string, value: string | null) {
  if (SECRET_CONFIG_KEYS.has(key)) {
    return {
      key,
      configured: Boolean(value),
    };
  }

  return { key, value };
}

/**
 * GET /api/admin/system-config/:key - Fetch a system config value
 * POST /api/admin/system-config/:key - Set a system config value
 *
 * Requires admin authentication
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    await requireAppAdmin(request);
    const { key } = await params;
    if (!isSystemConfigKey(key)) {
      return NextResponse.json(
        { error: "Config key not found" },
        { status: 404 },
      );
    }

    let value: string | null = null;
    try {
      value = await getSystemConfig(key);
    } catch {
      value = null;
    }

    await logServerEvent("info", "api.admin.system-config.get", {
      requestId,
      key,
      found: value !== null,
    });

    if (!value && !SECRET_CONFIG_KEYS.has(key)) {
      return NextResponse.json(
        { error: "Config key not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(serializeConfigValue(key, value));
  } catch (error) {
    if (error instanceof Response) return error;
    await logServerEvent("error", "api.admin.system-config.get.failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to fetch system config" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    await requireAppAdmin(request);
    const { key } = await params;
    const body = (await request.json()) as { value: string };

    if (!isSystemConfigKey(key)) {
      return NextResponse.json(
        { error: "Config key not found" },
        { status: 404 },
      );
    }

    if (!body.value || typeof body.value !== "string") {
      return NextResponse.json(
        { error: "Value must be a non-empty string" },
        { status: 400 },
      );
    }

    const success = await setSystemConfig(key, body.value);

    await logServerEvent("info", "api.admin.system-config.set", {
      requestId,
      key,
      success,
      valueLength: body.value.length,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to set system config" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...serializeConfigValue(key, body.value),
      updated: true,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    await logServerEvent("error", "api.admin.system-config.set.failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to set system config" },
      { status: 500 },
    );
  }
}
