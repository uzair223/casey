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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const SYSTEM_PROMPT = generateChatSystemPrompt(PERSONAL_INJURY_CONFIG);

const defaultProgress = (): ProgressData => {
  const phaseCompleteness: Record<string, number> = {};
  for (const phase of PERSONAL_INJURY_CONFIG.phases) {
    phaseCompleteness[`phase${phase.order}`] = 0;
  }

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

const getLastProgress = (conversationHistory: Message[]): ProgressData => {
  for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
    const message = conversationHistory[i];
    if (message?.role === "assistant" && message.progress) {
      return message.progress;
    }
  }
  return defaultProgress();
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  console.log(SYSTEM_PROMPT);
  const encoder = new TextEncoder();

  try {
    const { token } = await params;

    const isDemo = token === "demo";
    if (isDemo) {
      return new Response(null, { status: 200 });
    }

    const context = await getStatementContextServer(token);
    if (!context) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired link." }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (context.statement.status === "locked") {
      const progress = defaultProgress();
      const meta = {
        stopIntake: true,
        flaggedDeviation: true,
        deviationReason:
          "This intake was previously stopped because it went out of scope.",
      };

      const assistantContent = `This witness statement intake has already been stopped. Please contact the law firm for next steps.\n\n[END]\n[PROGRESS: ${JSON.stringify(progress)}]\n[META: ${JSON.stringify(meta)}]`;
      return new Response(assistantContent, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const body = await request.json();
    const { userMessage, conversationHistory } = body as {
      userMessage: string;
      conversationHistory: Message[];
    };

    if (!userMessage || typeof userMessage !== "string") {
      return new Response(
        JSON.stringify({ error: "userMessage is required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!Array.isArray(conversationHistory)) {
      return new Response(
        JSON.stringify({ error: "conversationHistory must be an array." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const lastProgress = getLastProgress(conversationHistory);
    const progressContext = `CURRENT PROGRESS STATE (build incrementally on this):
Current Phase: ${lastProgress.currentPhase}
Completed Phases: [${lastProgress.completedPhases.join(", ")}]
Phase Completeness: ${JSON.stringify(lastProgress.phaseCompleteness)}
Ready to Submit: ${lastProgress.readyToPrepare}

When generating the [PROGRESS: ...] block at the end of your response, use these values as your starting point. Only increment phaseCompleteness values as you gather NEW information from the user. Do not reset or decrease any values.`;

    let stream;
    try {
      stream = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          ...conversationHistory.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${progressContext}` },
        ],
        temperature: 0.7,
        stream: true,
      });
    } catch (apiError) {
      console.error("OpenAI API error:", apiError);

      const status =
        typeof apiError === "object" &&
        apiError !== null &&
        "status" in apiError
          ? Number((apiError as { status?: unknown }).status)
          : undefined;
      const code =
        typeof apiError === "object" && apiError !== null && "code" in apiError
          ? Number((apiError as { code?: unknown }).code)
          : undefined;

      // Handle rate limiting
      if (status === 429 || code === 429) {
        return new Response(
          "I apologize, but the AI service is currently experiencing high demand. Please try again in a moment.",
          {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          },
        );
      }

      // Handle other API errors
      return new Response(
        "I'm sorry, I encountered an error processing your message. Please try again.",
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        },
      );
    }

    let assistantContent = "";
    let hasAssistantResponse = false;
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              hasAssistantResponse = true;
              assistantContent += content;
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
          // Only try to enqueue error message if controller is not closed
          try {
            const errorMsg = "...[error occurred]";
            controller.enqueue(encoder.encode(errorMsg));
          } catch {
            // Controller already closed, ignore
          }
        } finally {
          const progress = parseProgress(assistantContent);
          const meta = parseMeta(assistantContent);
          const cleanedContent = cleanResponse(assistantContent);

          console.log(
            `model: ${process.env.OPENAI_MODEL}\nresponse:\n${assistantContent}`,
          );

          try {
            controller.close();
          } catch {
            // Controller already closed, ignore
          }

          if (hasAssistantResponse) {
            void (async () => {
              try {
                if (meta?.stopIntake) {
                  await updateStatementStatusServer(
                    context.statement.id,
                    "locked",
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
                  cleanedContent,
                  progress,
                  meta,
                );

                if (!meta?.stopIntake) {
                  await updateStatementStatusServer(
                    context.statement.id,
                    "in_progress",
                  );
                }
              } catch (persistError) {
                console.error("Failed to persist conversation:", persistError);
              }
            })();
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
    console.error("Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
