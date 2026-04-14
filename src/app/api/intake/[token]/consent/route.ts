import { NextResponse } from "next/server";
import { SERVERONLY_acknowledgeStatementNoticeByToken } from "@/lib/supabase/mutations";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")?.[0]?.trim() || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const notice = await SERVERONLY_acknowledgeStatementNoticeByToken(token, {
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });

    return NextResponse.json({ ok: true, notice });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save notice consent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
