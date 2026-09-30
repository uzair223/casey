import "server-only";

import OpenAI from "openai";

import {
  getCloudflareAiClientOptions,
  isCloudflareAiConfigured,
} from "@/lib/llm/cloudflare";
import { selectModel } from "@/lib/llm/model-config";
import { collectResponsesText } from "@/lib/llm/openai-responses";
import {
  acceptableOutreachNote,
  supportingOutreachFallback,
} from "@/lib/leads/qualify";

const client = new OpenAI(getCloudflareAiClientOptions());

export async function composeSupportingOutreachNote(params: {
  witnessName: string;
  clientName: string;
  role: string;
  firm: string;
}) {
  const fallback = supportingOutreachFallback(params);
  if (!isCloudflareAiConfigured()) return fallback;

  const role = params.role.trim().toLowerCase() || "colleague";
  const firm = params.firm.trim() || "the firm";
  const witnessName = params.witnessName.trim();
  const clientName = params.clientName.trim();

  try {
    const draft = await collectResponsesText({
      client,
      model: selectModel("supporting-outreach"),
      temperature: 0.4,
      instructions: [
        "You write a short email note. One or two conversational sentences. No subject line.",
        'Write in this shape: "Hello Aisha, Uzair Patel named you as a colleague regarding an incident that occurred. Demo is asking for your account."',
        "Use only the witness name, the person who named them, the role, and the firm.",
        "If the person who named them is missing, do not invent a name. Say they were named as that role regarding an incident that occurred.",
        'Do not mention injuries, treatment, hospital, time off work, or "the lead". Do not add any other facts.',
        "Return only the sentences.",
      ].join(" "),
      input: [
        {
          role: "user",
          content: JSON.stringify({
            witnessName: witnessName || null,
            namedBy: clientName || null,
            role,
            firm,
          }),
        },
      ],
    });
    const cleaned = draft
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return acceptableOutreachNote(cleaned) ? cleaned : fallback;
  } catch {
    return fallback;
  }
}
