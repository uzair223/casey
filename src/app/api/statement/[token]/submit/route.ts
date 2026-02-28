import { NextResponse } from "next/server";
import {
  submitStatement,
  updateStatementByTokenServer,
  type StatementSubmission,
} from "@/lib/supabase/queries";
import { DEMO_STATEMENT_DATA } from "@/lib/demoData";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (token === DEMO_STATEMENT_DATA.link!.token) {
      return NextResponse.json({ ok: true });
    }

    const body = (await request.json()) as StatementSubmission;

    if (!body?.signedDocument) {
      return NextResponse.json(
        { error: "signedDocument is required" },
        { status: 400 },
      );
    }

    await submitStatement(token, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit statement";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const { address, occupation } = (await request.json()) as {
      address?: string;
      occupation?: string;
    };
    if (!address || !occupation) return NextResponse.json("ok");
    await updateStatementByTokenServer(token, {
      witness_address: address ?? undefined,
      witness_occupation: occupation ?? undefined,
    });
    return NextResponse.json("ok");
  } catch (error) {
    console.error("Patch error:", error);
    return NextResponse.json("Failed to patch", { status: 500 });
  }
}
