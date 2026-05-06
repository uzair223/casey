import { NextRequest, NextResponse } from "next/server";
import {
  getSystemConfig,
  isSystemConfigKey,
  setSystemConfig,
} from "@/lib/supabase/system-config";
import { logServerEvent } from "@/lib/observability/logger";
import { randomUUID } from "crypto";

/**
 * GET /api/admin/system-config/:key - Fetch a system config value
 * POST /api/admin/system-config/:key - Set a system config value
 *
 * Requires admin authentication
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    const { key } = await params;
    if (!isSystemConfigKey(key)) {
      return NextResponse.json(
        { error: "Config key not found" },
        { status: 404 },
      );
    }

    const value = await getSystemConfig(key);

    await logServerEvent("info", "api.admin.system-config.get", {
      requestId,
      key,
      found: value !== null,
    });

    if (!value) {
      return NextResponse.json(
        { error: "Config key not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ key, value });
  } catch (error) {
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
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
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

    return NextResponse.json({ key, value: body.value, updated: true });
  } catch (error) {
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
