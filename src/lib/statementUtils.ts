import { Message, MetadataProgress, StatementStatus } from "@/lib/types";
import { StatementDataResponse } from "./supabase/queries";
import { PERSONAL_INJURY_CONFIG } from "./statementConfigs";
import {
  ResponseMetadataSchema,
  ResponseMetadataSchemaType,
} from "./schema/responseMetadata";
import { BadgeProps } from "@/components/ui/badge";

export const generateGreeting = (data: StatementDataResponse): Message[] => {
  const dateStr = data.incident_date
    ? new Date(data.incident_date).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const missing = [];
  if (!data.witness_address) missing.push("full home address");
  if (!data.witness_occupation) missing.push("occupation");

  const meta = {
    witnessDetails: {
      occupation: data.witness_occupation ?? undefined,
      address: data.witness_address ?? undefined,
    },
    progress: defaultProgress(),
    ignoredMissingDetails: [],
    evidence: { record: [] },
  };
  if (!missing.length) {
    meta.progress.currentPhase = 1;
    meta.progress.phaseCompleteness.phase0 = 100;
  }

  return [
    {
      role: "assistant",
      content: `Hello ${data.witness_name}, I'm here to help you prepare your witness statement for ${data.title} (Reference: ${data.reference}).${dateStr ? ` This relates to the incident on ${dateStr}.` : ""}
I'll guide you through the information collection process to ensure we capture all the important details accurately.`,
    },
    {
      role: "assistant",
      content: missing.length
        ? `To begin, could you please provide your ${missing.join(" and ")}?`
        : "To begin, could you please describe the incident in your own words?",
      meta,
    },
  ];
};

const META_REGEX = /\[META:\s*([\s\S]*?)\s*\]\s*$/;
const META_START_REGEX = /\[META[\s\S]*$/;

/**
 * Parse metadata from assistant response
 */
export const parseAndValidateResponse = (fullContent: string) => {
  const match = fullContent.match(META_REGEX);

  // No metadata block found
  if (!match) {
    return {
      content: fullContent.trim(),
      error: "Missing [META: ... ] block",
    };
  }

  const metaBlock = match[1].trim();

  // Content is everything before the match
  const content = fullContent.slice(0, match.index).trim();
  let parsed;
  try {
    parsed = JSON.parse(metaBlock);
  } catch {
    return {
      content,
      error: `Invalid JSON format:\n${metaBlock}`,
    };
  }

  const { data, error } = ResponseMetadataSchema.safeParse(parsed);
  if (error) {
    return { content, error };
  }
  return { content, meta: data };
};

/*
 * Remove everything after [META...
 */
export const cleanResponse = (content: string): string => {
  return content.replace(META_START_REGEX, "").trim();
};

/*
 * Default progress
 */
export const defaultProgress = (): MetadataProgress => {
  const phaseCompleteness = Object.fromEntries(
    PERSONAL_INJURY_CONFIG.phases.map((p) => [`phase${p.order}`, 0]),
  );

  return {
    currentPhase: 0,
    overallCompletion: 0,
    completedPhases: [],
    phaseCompleteness,
    readyToPrepare: false,
  };
};

export const defaultMeta = (): ResponseMetadataSchemaType => {
  return {
    progress: defaultProgress(),
    ignoredMissingDetails: [],
    evidence: { record: [] },
    witnessDetails: {},
  };
};

export const getLastMeta = (history: Message[]): ResponseMetadataSchemaType =>
  history
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.meta)?.meta ?? defaultMeta();

export const getLastProgress = (history: Message[]): MetadataProgress =>
  history
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.meta?.progress)?.meta?.progress ??
  defaultProgress();

export const statusBadgeStyles: Record<StatementStatus, BadgeProps["variant"]> =
  {
    draft: "secondary",
    in_progress: "default",
    submitted: "accent",
    locked: "outline",
  };

export const statusLabels: Record<StatementStatus, string> = {
  draft: "Draft",
  in_progress: "Collecting",
  submitted: "Review",
  locked: "Locked",
};
