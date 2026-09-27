import OpenAI from "openai";
import { NextResponse } from "next/server";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { logServerEvent } from "@/lib/observability/logger";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import { SERVERONLY_saveConversationMessage } from "@/lib/supabase/mutations";
import {
  generateGreeting,
  getMissingWitnessFieldLabels,
} from "@/lib/llm/prompts";
import {
  readEnquirySummary,
  readEnquiryTranscript,
  formatEnquiryTranscript,
} from "@/lib/leads/case-facts";
import type { IntakeChatMessage } from "@/types";
import { selectModel } from "@/lib/llm/model-config";
import { collectResponsesText } from "@/lib/llm/openai-responses";
import {
  getCloudflareAiClientOptions,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";

const client = new OpenAI(getCloudflareAiClientOptions());

const greetingSchema = z.object({
  greeting: z.string().trim().min(1).max(900),
  question: z.string().trim().max(240),
});

const GREETING_INSTRUCTIONS = `You write the opening of a witness account interview.

Return JSON with greeting and question.

greeting:
- Three or four short sentences, the way a person would speak.
- Greet them by their first name.
- Say you are here to take their full account.
- If enquirySummary is set, restate what they already said in everyday words: what happened and when. Say "you". Never say "the lead", "defendant", or the raw case title.
- Say briefly what this conversation will cover, using phaseTitles in everyday words.
- Describe the matter in everyday words. An internal title like "Uzair — Accident at work" should become "your accident at work".
- Do not mention a written draft, the firm, review, or what happens after this conversation.
- Do not give legal advice.
- Example: "Hi Uzair, I'm here to take your full account of your accident at work. You told us loose packages fell on your foot at work on 3 September. We'll go through the job you were doing, how you were hurt, what happened straight after, your treatment, and work since."

question:
- Ask one short question about firstPhase only.
- Do not ask for a list of missing facts such as employer, workplace, and time of day together.
- Do not use the word defendant.
- If firstPhase is empty and a missing field list is set, ask one short question for those details.
- If firstPhase is empty and both missing field lists are empty, return an empty string.
- Address them as "you". Do not repeat their name.`;

function witnessFacingGreeting(text: string) {
  const value = text
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
  if (!value) return null;
  if (/written draft|during review|the firm|defendant/i.test(value)) return null;
  return value;
}

function acceptableOpeningQuestion(text: string) {
  const value = text.trim();
  if (!value || /defendant/i.test(value)) return null;
  return value;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const { token } = await params;
    const data = await SERVERONLY_getFullStatementFromToken(token, true);

    if (!data) {
      return NextResponse.json("Invalid or expired link.", { status: 404 });
    }

    const accessError = await getIntakeAccessError(
      request,
      data.statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const persistGreeting = async (messages: IntakeChatMessage[]) => {
      for (const message of messages) {
        await SERVERONLY_saveConversationMessage(
          data.statement.id,
          message.role,
          message.content,
          (message.meta ?? null) as Record<string, unknown> | null,
        );
      }
    };

    const phases = data.statement.statement_config?.phases ?? [];
    const phaseTitles = phases.map((phase) => phase.title);
    const enquirySummary = readEnquirySummary(
      data.statement.qualification_answers,
    );
    const priorEnquiry = formatEnquiryTranscript(
      readEnquiryTranscript(data.statement.qualification_answers),
    );
    const fallback = generateGreeting(data.case, data.statement, {
      enquirySummary,
      phaseTitles,
    });
    const missing = getMissingWitnessFieldLabels(data.statement);

    if (!isCloudflareAiConfigured()) {
      await persistGreeting(fallback);
      return NextResponse.json(fallback);
    }

    try {
      const selectedModel = selectModel("intake-greeting");

      const generated = await collectResponsesText({
        client,
        model: selectedModel,
        promptCacheKey: `greeting:${data.statement.id}`,
        instructions: GREETING_INSTRUCTIONS,
        textFormat: zodTextFormat(greetingSchema, "account_greeting"),
        input: [
          {
            role: "user",
            content: JSON.stringify({
              witnessName: data.statement.witness_name,
              caseTitle: data.case.title,
              enquirySummary,
              phaseTitles,
              firstPhase: phases[0]
                ? {
                    title: phases[0].title,
                    objective: phases[0].objective,
                  }
                : null,
              requiredMissingFields: phases.length ? [] : missing.required,
              optionalMissingFields: phases.length ? [] : missing.optional,
              priorEnquiry: priorEnquiry || null,
            }),
          },
        ],
      });
      const parsed = greetingSchema.safeParse(JSON.parse(generated));
      const greeting = parsed.success
        ? witnessFacingGreeting(parsed.data.greeting)
        : null;

      if (!parsed.success || !greeting) {
        await persistGreeting(fallback);
        return NextResponse.json(fallback);
      }

      const result = [...fallback];
      if (result[0]) {
        result[0] = { ...result[0], content: greeting };
      }
      const question = acceptableOpeningQuestion(parsed.data.question);
      const canReplaceQuestion =
        phases.length > 0 ||
        missing.required.length > 0 ||
        missing.optional.length > 0;
      if (question && result[1] && canReplaceQuestion) {
        result[1] = { ...result[1], content: question };
      }

      await persistGreeting(result);
      return NextResponse.json(result);
    } catch (modelError) {
      await logServerEvent("warn", "api.intake.greeting.llm_fallback", {
        requestId,
        tokenSuffix: token.slice(-6),
        error: modelError,
      });
      await persistGreeting(fallback);
      return NextResponse.json(fallback);
    }
  } catch (error) {
    await logServerEvent("error", "api.intake.greeting.failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to prepare greeting." },
      { status: 500 },
    );
  }
}
