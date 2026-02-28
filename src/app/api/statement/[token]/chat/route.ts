import OpenAI from "openai";
import { NextResponse } from "next/server";

import { Message } from "@/lib/types";
import { ResponseMetadataSchemaType } from "@/lib/schema";

import {
  getStatementFromToken,
  saveConversationMessageServer,
  updateStatementStatusServer,
} from "@/lib/supabase/queries";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { generateChatSystemPrompt } from "@/lib/statementConfigs/prompts";
import {
  defaultProgress,
  getLastProgress,
  parseAndValidateResponse,
} from "@/lib/statementUtils";

import { randomUUID } from "crypto";
import { withRetry } from "@/lib/utils";
import { DEMO_STATEMENT_DATA } from "@/lib/demoData";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const SYSTEM_PROMPT = generateChatSystemPrompt(PERSONAL_INJURY_CONFIG);

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { status?: number; code?: number };
  return e.status === 429 || e.code === 429;
}

async function createOpenAIStreamWithRetry(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  requestId: string,
  retries = 3,
  delayMs = 1000,
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        temperature: 0.7,
        stream: true,
      });
    } catch (error) {
      if (isRateLimitError(error) && attempt < retries) {
        console.warn(
          `[${requestId}] Rate limit hit, retrying in ${delayMs}ms (attempt ${attempt})`,
        );
        await new Promise((res) => setTimeout(res, delayMs));
        delayMs *= 2; // exponential backoff
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    `[${requestId}] Failed to create OpenAI stream after ${retries} retries`,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const requestId = randomUUID();
  const encoder = new TextEncoder();

  try {
    const { token } = await params;

    if (token === DEMO_STATEMENT_DATA.link!.token)
      return NextResponse.json("ok");

    const statement = await getStatementFromToken(token);
    if (!statement) {
      return NextResponse.json("Invalid or expired link.", { status: 404 });
    }

    if (statement.status === "locked") {
      const meta: ResponseMetadataSchemaType = {
        progress: defaultProgress(),
        evidence: { record: [] },
        ignoredMissingDetails: [],
        deviation: {
          stopIntake: true,
          flaggedDeviation: true,
          deviationReason:
            "This intake was previously stopped because it went out of scope.",
        },
      };
      const message = `This witness statement intake has already been stopped. Please contact the law firm for next steps.\n[META: ${JSON.stringify(meta)}]`;
      return NextResponse.json(message, { status: 409 });
    }

    const body = await request.json();
    const { userMessage, conversationHistory } = body as {
      userMessage?: string;
      conversationHistory?: Message[];
    };

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json("userMessage is required.", { status: 400 });
    }

    if (!Array.isArray(conversationHistory)) {
      return NextResponse.json("conversationHistory must be an array.", {
        status: 400,
      });
    }

    const lastProgress = getLastProgress(conversationHistory);
    const progressContext = `CURRENT PROGRESS STATE (build incrementally on this):\n${JSON.stringify(lastProgress)}`;

    const messages = [
      ...conversationHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "system" as const,
        content: `${SYSTEM_PROMPT}\n${progressContext}`,
      },
      {
        role: "user" as const,
        content: userMessage,
      },
    ];

    let stream;

    try {
      stream = await createOpenAIStreamWithRetry(messages, requestId);
    } catch (error) {
      if (isRateLimitError(error)) {
        return NextResponse.json(
          "AI service is experiencing high demand. Please try again shortly.",
          { status: 429 },
        );
      }
      return NextResponse.json(
        "I encountered an error processing your message. Please try again.",
        { status: 500 },
      );
    }

    let assistantContent = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (!content) continue;

            assistantContent += content;
            controller.enqueue(encoder.encode(content));
          }
        } catch (err) {
          console.error(`[${requestId}] Stream error`, err);
        } finally {
          controller.close();

          void (async () => {
            try {
              console.log(`[${requestId}] Starting background persistence`);

              const { content, meta, error } =
                parseAndValidateResponse(assistantContent);
              if (error) {
                console.log(
                  `[${requestId}] Assistant response:\n${assistantContent}`,
                );
                console.error(
                  `[${requestId}] Malformed assistant response:\n${typeof error === "string" ? error : error?.message}`,
                );
                return;
              }

              if (meta?.deviation?.stopIntake) {
                await withRetry(() =>
                  updateStatementStatusServer(statement.id, "locked"),
                );
              } else {
                await withRetry(() =>
                  updateStatementStatusServer(statement.id, "in_progress"),
                );
              }

              await withRetry(() =>
                saveConversationMessageServer(
                  statement.id,
                  "user",
                  userMessage,
                ),
              );

              await withRetry(() =>
                saveConversationMessageServer(
                  statement.id,
                  "assistant",
                  content,
                  meta,
                ),
              );

              console.log(`[${requestId}] Background persistence complete`);
            } catch (persistError) {
              console.error(
                `[${requestId}] Background persistence error`,
                persistError,
              );
            }
          })();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Fatal API error`, error);
    return NextResponse.json(
      error instanceof Error ? error.message : "Unknown error",
      { status: 500 },
    );
  }
}
