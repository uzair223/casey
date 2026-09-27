import { IntakeChatMessage, MetadataProgress, StatementConfig } from "@/types";
import {
  ResponseMetadata,
  ResponseMetadataSchema,
} from "../schema/response-metadata";

export const CHAT_METADATA_MARKER = "\n\n[[METADATA]]";

/*
 * Default progress
 */
export const defaultProgress = (
  statementConfig: StatementConfig,
): MetadataProgress => {
  const phaseCompleteness = Object.fromEntries(
    statementConfig.phases.map((phase) => [phase.id, 0]),
  );
  return {
    currentPhase: "",
    overallCompletion: 0,
    phaseCompleteness,
    readyToPrepare: false,
  };
};

export const defaultMeta = (
  statementConfig: StatementConfig,
): ResponseMetadata => {
  return {
    witnessDetails: null,
    caseDetails: null,
    progress: defaultProgress(statementConfig),
    ignoredMissingDetails: null,
    evidence: { record: [], requestedEvidence: null },
    deviation: null,
  };
};

function withCaseDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  if ("caseDetails" in value) return value;
  return { ...value, caseDetails: null };
}

export const getResponseMetadata = (
  value: unknown,
  config: StatementConfig,
): ResponseMetadata | null => {
  const parsed = ResponseMetadataSchema(config).safeParse(withCaseDetails(value));
  return parsed.success ? parsed.data : null;
};

export const getMessageResponseMeta = (
  message: Pick<IntakeChatMessage, "meta"> | null | undefined,
  config: StatementConfig,
): ResponseMetadata | null => getResponseMetadata(message?.meta, config);

export const getLastMeta = (
  history: IntakeChatMessage[],
  config: StatementConfig,
): ResponseMetadata => {
  for (const message of history.slice().reverse()) {
    if (message.role !== "assistant") {
      continue;
    }

    const metadata = getMessageResponseMeta(message, config);
    if (metadata) {
      return metadata;
    }
  }

  return defaultMeta(config);
};

export const getLastProgress = (
  history: IntakeChatMessage[],
  config: StatementConfig,
): MetadataProgress =>
  history
    .slice()
    .reverse()
    .filter((message) => message.role === "assistant")
    .map((message) => getMessageResponseMeta(message, config))
    .find((metadata) => metadata?.progress)?.progress ??
  defaultProgress(config);

export function preservePhaseHighWater(
  metadata: ResponseMetadata,
  history: IntakeChatMessage[],
  config: StatementConfig,
): ResponseMetadata {
  const next = structuredClone(metadata);
  for (const message of history) {
    if (message.role !== "assistant") continue;
    const prior = getMessageResponseMeta(message, config);
    if (!prior) continue;
    for (const [phase, value] of Object.entries(prior.progress.phaseCompleteness)) {
      if (!(phase in next.progress.phaseCompleteness) || typeof value !== "number") {
        continue;
      }
      next.progress.phaseCompleteness[phase] = Math.max(
        next.progress.phaseCompleteness[phase] ?? 0,
        value,
      );
    }
  }
  const values = Object.values(next.progress.phaseCompleteness);
  if (values.length > 0) {
    next.progress.overallCompletion = Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }
  return next;
}
