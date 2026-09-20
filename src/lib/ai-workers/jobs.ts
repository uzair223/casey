import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { processCaseAnalysisJob } from "@/lib/ai-workers/case-analysis";
import { processFormalizationJob } from "@/lib/ai-workers/statement-formalization";

export const AI_JOB_KINDS = [
  "statement_formalization",
  "case_analysis",
] as const;

export type AiJobKind = (typeof AI_JOB_KINDS)[number];

export type AiJobMessage = {
  jobId: string;
  kind: AiJobKind;
};

export function isAiJobKind(value: unknown): value is AiJobKind {
  return value === "statement_formalization" || value === "case_analysis";
}

export async function processAiJob(message: AiJobMessage) {
  if (message.kind === "case_analysis") {
    return processCaseAnalysisJob(message.jobId);
  }

  return processFormalizationJob(message.jobId);
}

export async function enqueueAiJob(message: AiJobMessage) {
  const context = await getCloudflareContext({ async: true }).catch(() => null);
  const queue = context?.env.AI_JOBS;

  if (queue) {
    await queue.send(message);
    if (process.env.NODE_ENV === "production") {
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("AI_JOBS queue binding is not configured");
  }

  await processAiJob(message);
}
