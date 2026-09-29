import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  getCloudflareAiClientOptions,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";
import { selectModel } from "@/lib/llm/model-config";
import { collectResponsesText } from "@/lib/llm/openai-responses";
import { logServerEvent } from "@/lib/observability/logger";

import { parseEnquiryCaseFacts } from "./case-facts";

const client = new OpenAI(getCloudflareAiClientOptions());

const CaseFactsSchema = z.object({
  facts: z.array(
    z.object({
      id: z.string().nullable(),
      value: z.string().nullable(),
    }),
  ),
});

export async function inferEnquiryCaseFacts(params: {
  transcript: string;
  fields: Array<{ id: string; label: string; type?: "text" | "number" | "date" }>;
}) {
  const transcript = params.transcript.trim();
  if (!transcript || params.fields.length === 0) return {};
  if (!isCloudflareAiConfigured()) {
    await logServerEvent("warn", "leads.case_facts.llm_unconfigured", {});
    return {};
  }

  const fieldList = params.fields
    .map((field) => `${field.id} (${field.label})`)
    .join(", ");
  try {
    const text = await collectResponsesText({
      client,
      model: selectModel("intake-chat"),
      promptCacheKey: "enquiry-case-facts",
      textFormat: zodTextFormat(CaseFactsSchema, "enquiry_case_facts"),
      instructions: [
        "Extract case details this person stated.",
        `Use only these fields: ${fieldList}.`,
        "The claimant is their name, not their job and not a description of what they were doing.",
        "Copy a value only when they said those words. Otherwise omit the field.",
        "Do not invent a name, employer, place, or date.",
      ].join(" "),
      input: [{ role: "user", content: transcript }],
    });
    return parseEnquiryCaseFacts({
      raw: text,
      transcript,
      fields: params.fields,
    });
  } catch (error) {
    await logServerEvent("warn", "leads.case_facts.llm_failed", { error });
    return {};
  }
}
