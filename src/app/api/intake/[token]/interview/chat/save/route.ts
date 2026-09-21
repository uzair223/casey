import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { SERVERONLY_saveConversationMessage } from "@/lib/supabase/mutations";
import { IntakeChatMessage } from "@/types";
import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      return NextResponse.json("Invalid or expired link.", { status: 404 });
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const message = (await request.json()) as IntakeChatMessage;

    if (message.role !== "user") {
      return NextResponse.json(
        "Only user messages can be saved from the client.",
        { status: 400 },
      );
    }

    if (typeof message.content !== "string" || !message.content.trim()) {
      return NextResponse.json("Message content is required.", { status: 400 });
    }

    await SERVERONLY_saveConversationMessage(
      statement.id,
      "user",
      message.content,
      message.meta,
    );
    return NextResponse.json("ok");
  } catch (error) {
    console.error("Save message error:", error);
    return NextResponse.json("Failed to persist", { status: 500 });
  }
}
