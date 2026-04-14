import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { SERVERONLY_saveConversationMessage } from "@/lib/supabase/mutations";
import { getServiceClient } from "@/lib/supabase/server";
import { Message } from "@/types";
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

    const message = (await request.json()) as Message;

    if (message.role === "assistant") {
      const supabase = getServiceClient();
      const { data: existing, error: existingError } = await supabase
        .from("conversation_messages")
        .select("id")
        .eq("statement_id", statement.id)
        .eq("role", "assistant")
        .eq("content", message.content)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        return NextResponse.json("ok");
      }
    }

    await SERVERONLY_saveConversationMessage(
      statement.id,
      message.role,
      message.content,
      message.meta,
    );
    return NextResponse.json("ok");
  } catch (error) {
    console.error("Save message error:", error);
    return NextResponse.json("Failed to persist", { status: 500 });
  }
}
