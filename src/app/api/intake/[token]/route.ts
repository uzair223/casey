import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const data = await SERVERONLY_getFullStatementFromToken(token, true);
    if (!data) throw Error("Invalid token");

    const accessError = await getIntakeAccessError(
      request,
      data.statement.status,
      "view",
    );
    if (accessError) {
      return accessError;
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Link not available" }, { status: 404 });
  }
}
