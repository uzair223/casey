import {
  getStatementFromToken,
  saveConversationMessageServer,
} from "@/lib/supabase/queries";
import { Message } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const statement = await getStatementFromToken(token);
    const message = (await request.json()) as Message;
    await saveConversationMessageServer(
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
