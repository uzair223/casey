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

import { parseSupportingPeople, type SupportingPersonProposal } from "./qualify";

const client = new OpenAI(getCloudflareAiClientOptions());

const SupportingPeopleSchema = z.object({
  people: z.array(
    z.object({
      name: z.string().nullable(),
      roleKey: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    }),
  ),
});

export async function inferSupportingPeople(params: {
  transcript: string;
  roles: Array<{ key: string; label: string }>;
  claimantEmail?: string | null;
}): Promise<SupportingPersonProposal[]> {
  const transcript = params.transcript.trim();
  if (!transcript || params.roles.length === 0) return [];
  if (!isCloudflareAiConfigured()) {
    await logServerEvent("warn", "leads.supporting_people.llm_unconfigured", {});
    return [];
  }

  const roleList = params.roles
    .map((role) => `${role.key} (${role.label})`)
    .join(", ");
  try {
    const text = await collectResponsesText({
      client,
      model: selectModel("intake-chat"),
      promptCacheKey: "supporting-people",
      textFormat: zodTextFormat(SupportingPeopleSchema, "supporting_people"),
      instructions: [
        "List other people named in this account, besides the person giving it.",
        `Assign each person one roleKey from: ${roleList}.`,
        "Copy email and phone only when that exact detail was said. Otherwise use null.",
        "If someone is named and no email or phone was given, still include them.",
        "Do not invent a person or a contact detail.",
      ].join(" "),
      input: [{ role: "user", content: transcript }],
    });
    return parseSupportingPeople({
      raw: text,
      transcript,
      roleKeys: params.roles.map((role) => role.key),
      claimantEmail: params.claimantEmail,
    });
  } catch (error) {
    await logServerEvent("warn", "leads.supporting_people.llm_failed", {
      error,
    });
    return [];
  }
}
