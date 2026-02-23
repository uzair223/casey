import { NextResponse } from "next/server";
import {
  submitStatementServer,
  type StatementSubmission,
} from "@/lib/supabase/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (token === "demo") {
      return NextResponse.json({ ok: true });
    }

    const body = (await request.json()) as StatementSubmission;

    if (!body?.signedDocument) {
      return NextResponse.json(
        { error: "signedDocument is required" },
        { status: 400 },
      );
    }

    await submitStatementServer(token, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit statement";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
