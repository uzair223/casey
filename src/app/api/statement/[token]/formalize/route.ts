import OpenAI from "openai";
import { getStatementFromToken } from "@/lib/supabase/queries";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { generateFormalizeSystemPrompt } from "@/lib/statementConfigs/prompts";
import { NextResponse } from "next/server";
import { withRetry } from "@/lib/utils";
import { DEMO_STATEMENT_DATA } from "@/lib/demoData";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const SYSTEM_PROMPT = generateFormalizeSystemPrompt(PERSONAL_INJURY_CONFIG);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json("OpenAI API key not configured.", {
        status: 500,
      });
    }

    const { token } = await params;
    if (token === DEMO_STATEMENT_DATA.link!.token)
      return NextResponse.json("ok");

    const statement = await getStatementFromToken(token);
    if (!statement || statement.status === "locked") {
      return NextResponse.json("Unauthorized or locked.", { status: 409 });
    }

    const { responses, evidence } = (await request.json()) as {
      responses: { role: "user" | "assistant"; content: string }[];
      evidence: { name: string; type: string }[];
    };

    // 1. Build the JSON Schema dynamically from your config
    const properties: Record<string, { type: "string" }> = {};
    const requiredFields: string[] = [];

    PERSONAL_INJURY_CONFIG.sections.forEach((section) => {
      properties[section.field] = { type: "string" };
      requiredFields.push(section.field);
    });

    // 2. Call OpenAI with response_format
    const parsed = await withRetry(async () => {
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...responses,
          {
            role: "system",
            content: `User provided evidence: ${JSON.stringify(evidence)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "witness_statement",
            strict: true,
            schema: {
              type: "object",
              properties: properties,
              required: requiredFields,
              additionalProperties: false,
            },
          },
        },
        temperature: 0, // Lower temperature is better for structured extraction
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");
      return JSON.parse(content);
    });
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Formalize error:", error);
    return NextResponse.json("Failed to formalize statement", { status: 500 });
  }
}
