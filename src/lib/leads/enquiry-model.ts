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

import {
  enquiryContact,
  enquiryInstructions,
  isEnquiryFullName,
  parseEnquiryJson,
  type EnquiryExtraction,
} from "./enquiry";
import type { QualificationSlot } from "./schema";
import type { SlotAnswers } from "./qualify";

const client = new OpenAI(getCloudflareAiClientOptions());

const EnquiryTurnSchema = z.object({
  reply: z.string(),
  overviewReady: z.boolean(),
  summary: z.string().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

export async function generateEnquiryTurn(params: {
  firmName: string;
  leadTypeName: string;
  briefGuidance?: string | null;
  slots: QualificationSlot[];
  answers: SlotAnswers;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  note?: string;
}): Promise<EnquiryExtraction | null> {
  if (!isCloudflareAiConfigured()) return null;
  const contact = enquiryContact(params.slots, params.answers);
  const summary = (params.answers.summary ?? "").trim();
  try {
    const text = await collectResponsesText({
      client,
      model: selectModel("intake-chat"),
      promptCacheKey: `enquiry:${params.leadTypeName}`,
      textFormat: zodTextFormat(EnquiryTurnSchema, "enquiry_turn"),
      instructions: [
        enquiryInstructions({
          firmName: params.firmName,
          leadTypeName: params.leadTypeName,
          hasOverview: summary.length >= 40,
          hasName: isEnquiryFullName(contact.name),
          givenName: isEnquiryFullName(contact.name) ? "" : contact.name,
          hasEmail: Boolean(contact.email),
          hasPhone: Boolean(contact.phone),
          briefGuidance: params.briefGuidance,
        }),
        params.note?.trim(),
      ]
        .filter(Boolean)
        .join("\n\n"),
      input: params.messages.slice(-12).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });
    return parseEnquiryJson(text);
  } catch (error) {
    await logServerEvent("warn", "leads.enquiry.llm_failed", { error });
    return null;
  }
}
