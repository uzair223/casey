import OpenAI from "openai";
import { Message, ProgressData } from "@/lib/types";
import {
  getStatementContextServer,
  saveConversationMessageServer,
  updateStatementStatusServer,
} from "@/lib/supabase/queries";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { generateChatSystemPrompt } from "@/lib/statementConfigs/prompts";
import { cleanResponse, parseMeta, parseProgress } from "@/lib/intakeUtils";
import { randomUUID } from "crypto";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const SYSTEM_PROMPT = generateChatSystemPrompt(PERSONAL_INJURY_CONFIG);

const textResponse = (text: string, status = 200) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

const defaultProgress = (): ProgressData => {
  const phaseCompleteness = Object.fromEntries(
    PERSONAL_INJURY_CONFIG.phases.map((p) => [`phase${p.order}`, 0]),
  );

  return {
    currentPhase: 1,
    completedPhases: [],
    phaseCompleteness,
    structuredData: {
      currentPhase: 1,
      overallCompletion: 0,
    },
    readyToPrepare: false,
  };
};

const getLastProgress = (history: Message[]): ProgressData =>
  history
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.progress)?.progress ??
  defaultProgress();

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { status?: number; code?: number };
  return e.status === 429 || e.code === 429;
}

async function createOpenAIStream(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  requestId: string,
) {
  try {
    return await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.7,
      stream: true,
    });
  } catch (error) {
    console.error(`[${requestId}] OpenAI API error`, error);

    if (isRateLimitError(error)) {
      throw new Error("RATE_LIMIT");
    }

    throw new Error("OPENAI_ERROR");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const requestId = randomUUID();
  const encoder = new TextEncoder();

  try {
    const { token } = await params;

    if (token === "demo") return textResponse("");

    const context = await getStatementContextServer(token);
    if (!context) {
      return textResponse("Invalid or expired link.", 404);
    }

    if (context.statement.status === "locked") {
      const progress = defaultProgress();
      const meta = {
        stopIntake: true,
        flaggedDeviation: true,
        deviationReason:
          "This intake was previously stopped because it went out of scope.",
      };

      const message = `This witness statement intake has already been stopped. Please contact the law firm for next steps.

[END]
[PROGRESS: ${JSON.stringify(progress)}]
[META: ${JSON.stringify(meta)}]`;

      return textResponse(message);
    }

    const body = await request.json();
    const { userMessage, conversationHistory } = body as {
      userMessage?: string;
      conversationHistory?: Message[];
    };

    if (!userMessage || typeof userMessage !== "string") {
      return textResponse("userMessage is required.", 400);
    }

    if (!Array.isArray(conversationHistory)) {
      return textResponse("conversationHistory must be an array.", 400);
    }

    const lastProgress = getLastProgress(conversationHistory);

    const progressContext = `
CURRENT PROGRESS STATE (build incrementally on this):
Current Phase: ${lastProgress.currentPhase}
Completed Phases: [${lastProgress.completedPhases.join(", ")}]
Phase Completeness: ${JSON.stringify(lastProgress.phaseCompleteness)}
Ready to Submit: ${lastProgress.readyToPrepare}

When generating the [PROGRESS: ...] block:
- Use these values as your starting point
- Only increment values when NEW info is gathered
- Never decrease values
`;

    const messages = [
      ...conversationHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "system" as const,
        content: `${SYSTEM_PROMPT}\n${progressContext}`,
      },
    ];

    let stream;

    try {
      stream = await createOpenAIStream(messages, requestId);
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMIT") {
        return textResponse(
          "AI service is experiencing high demand. Please try again shortly.",
        );
      }
      return textResponse(
        "I encountered an error processing your message. Please try again.",
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

          try {
            const progress = parseProgress(assistantContent);
            const meta = parseMeta(assistantContent);
            const cleaned = cleanResponse(assistantContent);

            if (meta?.stopIntake) {
              await updateStatementStatusServer(context.statement.id, "locked");
            } else {
              await updateStatementStatusServer(
                context.statement.id,
                "in_progress",
              );
            }

            await saveConversationMessageServer(
              context.statement.id,
              "user",
              userMessage,
            );

            await saveConversationMessageServer(
              context.statement.id,
              "assistant",
              cleaned,
              progress,
              meta,
            );
          } catch (persistError) {
            console.error(`[${requestId}] Persistence error`, persistError);
          }
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
    return textResponse(
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }
}
