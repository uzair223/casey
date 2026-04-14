import { Message, MetadataProgress, StatementConfig } from "@/types";
import { ResponseMetadata } from "../schema/response-metadata";

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

export const getLastMeta = (
  history: Message[],
  config: StatementConfig,
): ResponseMetadata =>
  history
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.meta)?.meta ?? defaultMeta(config);

export const getLastProgress = (
  history: Message[],
  config: StatementConfig,
): MetadataProgress =>
  history
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && m.meta?.progress)?.meta?.progress ??
  defaultProgress(config);
