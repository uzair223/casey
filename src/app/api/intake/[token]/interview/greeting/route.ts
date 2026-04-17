import OpenAI from "openai";
import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import { env } from "@/lib/env";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { logServerEvent } from "@/lib/observability/logger";
import { SERVERONLY_getFullStatementFromToken } from "@/lib/supabase/queries";
import {
  generateGreeting,
  getMissingRequiredWitnessFieldLabels,
} from "@/lib/statement-utils/prompts";
import { getOpenRouterClientOptions } from "@/lib/utils";

const client = new OpenAI(getOpenRouterClientOptions());

const greetingQuestionSchema = z.object({
  question: z.string().trim().min(1),
});

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

    const fallback = generateGreeting(data.case, data.statement);
    const missing = getMissingRequiredWitnessFieldLabels(data.statement);

    if (missing.length === 0 || !env.OPENROUTER_API_KEY) {
      return NextResponse.json(fallback);
    }

    try {
      const completion = await client.chat.completions.create({
        model: env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        temperature: 0.2,
        response_format: zodResponseFormat(
          greetingQuestionSchema,
          "greeting_missing_fields_question",
        ),
        messages: [
          {
            role: "system",
            content:
              "Write one warm, concise intake question asking for all missing witness details in natural language. Ask exactly one question and keep it under 30 words.",
          },
          {
            role: "user",
            content: JSON.stringify({
              witnessName: data.statement.witness_name,
              missingFields: missing,
            }),
          },
        ],
      });

      const generated = completion.choices[0]?.message?.content ?? "";
      const parsed = greetingQuestionSchema.safeParse(
        JSON.parse(generated || "{}"),
      );

      if (!parsed.success) {
        return NextResponse.json(fallback);
      }

      const result = [...fallback];
      if (result[1]) {
        result[1] = {
          ...result[1],
          content: parsed.data.question,
        };
      }

      return NextResponse.json(result);
    } catch (modelError) {
      await logServerEvent("warn", "api.intake.greeting.llm_fallback", {
        requestId,
        tokenSuffix: token.slice(-6),
        error: modelError,
      });
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
