import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getStatementContextServer } from "@/lib/supabase/queries";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { generateFormalizeSystemPrompt } from "@/lib/statementConfigs/prompts";

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
      return NextResponse.json(
        { error: "OpenAI API key not configured." },
        { status: 500 },
      );
    }

    const { token } = await params;
    if (token === "demo") return NextResponse.json(undefined, { status: 200 });

    const context = await getStatementContextServer(token);
    if (!context || context.statement.status === "locked") {
      return NextResponse.json(
        { error: "Unauthorized or locked." },
        { status: 409 },
      );
    }

    const { responses } = await request.json();

    // 1. Build the JSON Schema dynamically from your config
    const properties: Record<string, { type: "string" }> = {};
    const requiredFields: string[] = [];

    PERSONAL_INJURY_CONFIG.sections.forEach((section) => {
      properties[section.field] = { type: "string" };
      requiredFields.push(section.field);
    });

    // 2. Call OpenAI with response_format
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...responses],
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

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Formalize error:", error);
    return NextResponse.json(
      { error: "Failed to formalize statement" },
      { status: 500 },
    );
  }
}
