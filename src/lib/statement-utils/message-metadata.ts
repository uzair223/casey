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
    progress: defaultProgress(statementConfig),
    ignoredMissingDetails: null,
    evidence: { record: [], requestedEvidence: null },
    deviation: null,
  };
};

export const getResponseMetadata = (
  value: unknown,
  config: StatementConfig,
): ResponseMetadata | null => {
  const parsed = ResponseMetadataSchema(config).safeParse(value);
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
