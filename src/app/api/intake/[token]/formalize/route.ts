import { OpenRouter } from "@openrouter/sdk";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";
import { generateFormalizeSystemPrompt } from "@/lib/statement-utils/prompts";
import { NextResponse } from "next/server";
import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { Allow, parse as parsePartialJson } from "partial-json";
import { z } from "zod";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isRetriableError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { status?: number; code?: string; name?: string };
  return e.status === 429 || e.status === 502 || e.status === 503;
}

function isAbortError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { name?: string; code?: string };
  return e.name === "AbortError" || e.code === "ABORT_ERR";
}

function isStructuredParseOrValidationError(error: unknown) {
  if (error instanceof SyntaxError) return true;
  if (error instanceof z.ZodError) return true;
  return false;
}

function parseFormalizeContent(
  content: string,
  schema: z.ZodObject<Record<string, z.ZodString>>,
) {
  try {
    return schema.parse(JSON.parse(content));
  } catch (strictError) {
    // Some providers may still produce near-valid JSON despite json_schema mode.
    // Attempt a safe recovery parse, then validate strictly with Zod.
    try {
      const recovered = parsePartialJson(content, Allow.OBJ | Allow.STR);
      return schema.parse(recovered);
    } catch {
      throw strictError;
    }
  }
}

function buildEvidenceList(
  evidence: { exhibit: string; description: string }[],
) {
  if (!evidence.length) {
    return "No confirmed evidence provided.";
  }

  return evidence
    .map((item, index) => {
      const exhibit = item.exhibit.trim();
      const description = item.description.trim();
      const label = exhibit ? `- ${exhibit}` : `- Evidence ${index + 1}`;

      if (!description) {
        return label;
      }

      return `${label}: ${description}`;
    })
    .join("\n");
}

function getEvidenceSectionIds(
  sections: Array<{ id: string; title: string; description?: string | null }>,
) {
  const primaryKeywords = [
    "evidence",
    "supporting evidence",
    "supporting",
    "exhibit",
    "exhibits",
    "documents",
    "document",
    "attachments",
    "attachment",
    "records",
    "record",
    "proof",
    "materials",
  ];
  const secondaryKeywords = [
    "witness",
    "corroboration",
    "files",
    "file",
    "photos",
    "images",
    "receipts",
    "invoices",
    "reports",
    "medical",
    "support",
  ];

  return sections
    .map((section) => {
      const haystack =
        `${section.id} ${section.title} ${section.description ?? ""}`.toLowerCase();
      let score = 0;

      for (const keyword of primaryKeywords) {
        if (haystack.includes(keyword)) {
          score += 3;
        }
      }

      for (const keyword of secondaryKeywords) {
        if (haystack.includes(keyword)) {
          score += 1;
        }
      }

      return {
        id: section.id,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.id);
}

function normalizeEvidence(
  evidence: { exhibit: string; description: string }[],
) {
  return evidence
    .map((item) => ({
      exhibit: item.exhibit.trim(),
      description: item.description.trim(),
    }))
    .filter((item) => item.exhibit || item.description);
}

function includesEvidenceItem(
  text: string,
  item: { exhibit: string; description: string },
) {
  const haystack = text.toLowerCase();

  if (item.exhibit) {
    return haystack.includes(item.exhibit.toLowerCase());
  }

  if (item.description) {
    return haystack.includes(item.description.toLowerCase());
  }

  return true;
}

function mergeMissingEvidenceIntoOutput(
  parsed: Record<string, string>,
  sections: Array<{ id: string; title: string; description?: string | null }>,
  evidence: { exhibit: string; description: string }[],
) {
  const normalizedEvidence = normalizeEvidence(evidence);
  if (!normalizedEvidence.length) {
    return parsed;
  }

  const evidenceSectionIds = getEvidenceSectionIds(sections);
  if (!evidenceSectionIds.length) {
    return parsed;
  }

  const combinedEvidenceText = evidenceSectionIds
    .map((id) => parsed[id] ?? "")
    .join("\n")
    .toLowerCase();

  const missing = normalizedEvidence.filter(
    (item) => !includesEvidenceItem(combinedEvidenceText, item),
  );

  if (!missing.length) {
    return parsed;
  }

  const missingLines = missing.map((item, index) => {
    const exhibitLabel = item.exhibit || `Evidence ${index + 1}`;
    if (!item.description) {
      return `- ${exhibitLabel}`;
    }
    return `- ${exhibitLabel}: ${item.description}`;
  });

  const targetSectionId = evidenceSectionIds[0];
  const existing = (parsed[targetSectionId] ?? "").trim();
  const injectedBlock = `Confirmed exhibits:\n${missingLines.join("\n")}`;

  parsed[targetSectionId] = existing
    ? `${existing}\n\n${injectedBlock}`
    : injectedBlock;

  return parsed;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured." },
        {
          status: 500,
        },
      );
    }

    const { token } = await params;

    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);
    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    if (statement.status === "locked") {
      return NextResponse.json(
        { error: "Unauthorized or locked." },
        { status: 409 },
      );
    }

    const statementConfig = statement.statement_config || {
      name: "Default",
      agents: { chat: "", formalize: "" },
      phases: [],
      sections: [],
      witness_metadata_fields: [],
      case_metadata_deps: [],
      prompts: null,
    };

    const { responses, evidence } = (await request.json()) as {
      responses: { role: "user" | "assistant"; content: string }[];
      evidence: { exhibit: string; description: string }[];
    };

    const maxUserTurns = parsePositiveInt(
      process.env.OPENAI_FORMALIZE_MAX_USER_TURNS,
      40,
    );
    const maxCharsPerTurn = parsePositiveInt(
      process.env.OPENAI_FORMALIZE_MAX_CHARS_PER_TURN,
      1200,
    );
    const formalizeTimeoutMs = parsePositiveInt(
      process.env.OPENAI_FORMALIZE_TIMEOUT_MS,
      45000,
    );
    const maxAttempts = parsePositiveInt(
      process.env.OPENAI_FORMALIZE_MAX_ATTEMPTS,
      3,
    );

    const normalizedUserResponses = responses
      .filter((response) => response.role === "user")
      .map((response) => response.content.trim())
      .filter(Boolean)
      .slice(-maxUserTurns)
      .map((content, index) => {
        const normalized = content.replace(/\s+/g, " ").trim();
        const bounded = normalized.slice(0, maxCharsPerTurn);
        return `${index + 1}. ${bounded}`;
      });

    const transcriptText = normalizedUserResponses.length
      ? normalizedUserResponses.join("\n")
      : "No user transcript available.";
    const evidenceList = buildEvidenceList(evidence ?? []);

    // Build strict structured output schema from configured section ids.
    const sectionEntries = Object.fromEntries(
      statementConfig.sections.map((section) => [section.id, z.string()]),
    );
    const formalizeSchema = z.object(sectionEntries).strict();
    const formalizeJsonSchema = {
      type: "object",
      properties: Object.fromEntries(
        statementConfig.sections.map((section) => [
          section.id,
          { type: "string" },
        ]),
      ),
      required: statementConfig.sections.map((section) => section.id),
      additionalProperties: false,
    } as const;

    let parsed: Record<string, string> | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), formalizeTimeoutMs);
      try {
        const result = client.callModel(
          {
            model:
              process.env.OPENAI_FORMALIZE_MODEL ||
              process.env.OPENAI_MODEL ||
              "gpt-4o-mini",
            instructions: generateFormalizeSystemPrompt(
              statementConfig,
              evidenceList,
            ),
            input: [
              {
                role: "user",
                content: `Witness responses (user-only transcript):\n${transcriptText}`,
              },
            ],
            text: {
              format: {
                type: "json_schema",
                name: "witness_statement",
                strict: true,
                schema: formalizeJsonSchema,
              },
            },
          },
          { signal: controller.signal },
        );

        const content = await result.getText();
        if (!content) {
          throw new Error("Empty AI response");
        }

        parsed = parseFormalizeContent(content, formalizeSchema);
        break;
      } catch (error) {
        lastError = error;
        if (
          (!isRetriableError(error) &&
            !isStructuredParseOrValidationError(error)) ||
          attempt === maxAttempts
        ) {
          break;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!parsed) {
      if (isAbortError(lastError)) {
        return NextResponse.json(
          { error: "Formalization timed out. Please try again." },
          { status: 504 },
        );
      }
      throw lastError ?? new Error("Failed to formalize statement");
    }

    const parsedWithEvidence = mergeMissingEvidenceIntoOutput(
      parsed,
      statementConfig.sections,
      evidence ?? [],
    );

    return NextResponse.json(parsedWithEvidence);
  } catch (error) {
    console.error("Formalize error:", error);
    return NextResponse.json(
      { error: "Failed to formalize statement" },
      { status: 500 },
    );
  }
}
