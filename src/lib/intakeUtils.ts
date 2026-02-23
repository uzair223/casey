import { Message, ProgressData } from "@/lib/types";
import { StatementDataResponse } from "./supabase/queries";
import { END_OF_RESPONSE_MARKER } from "./statementConfigs";

export const generateGreeting = (data: StatementDataResponse): Message => {
  const dateStr = data.incident_date
    ? new Date(data.incident_date).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return {
    id: "",
    role: "assistant",
    content: `Hello ${data.witness_name}, I'm here to help you prepare your witness statement for ${data.title} (Reference: ${data.reference}).${dateStr ? ` This relates to the incident on ${dateStr}.` : ""}
I'll guide you through the information collection process to ensure we capture all the important details accurately.
Let's start with what happened. Can you describe the incident and what you experienced?`,
  };
};

/**
 * Parse progress data from assistant response
 */
export const parseProgress = (content: string): ProgressData | null => {
  const progressMatch = content.match(/\[PROGRESS:\s*(\{[\s\S]*?\})\]/);
  if (!progressMatch) return null;

  try {
    const progressData = JSON.parse(progressMatch[1]);
    return {
      currentPhase: progressData.currentPhase || 1,
      completedPhases: progressData.completedPhases || [],
      phaseCompleteness: progressData.phaseCompleteness || {},
      structuredData: progressData.structuredData,
      readyToPrepare: progressData.readyToPrepare || false,
    };
  } catch {
    return null;
  }
};

/**
 * Parse metadata from assistant response
 */
export const parseMeta = (
  content: string,
): {
  requiresEvidenceUpload?: boolean;
  allowedTypes?: string[];
  stopIntake?: boolean;
  flaggedDeviation?: boolean;
  deviationReason?: string;
} | null => {
  const metaMatch = content.match(/\[META:\s*(\{[\s\S]*?\})\]/);
  if (!metaMatch) return null;

  try {
    return JSON.parse(metaMatch[1]);
  } catch {
    return null;
  }
};

/**
 * Remove progress and metadata markers from response
 * Handles partial tags by making closing bracket optional
 */
export const cleanResponse = (content: string): string => {
  const markerIndex = content.indexOf(END_OF_RESPONSE_MARKER);
  const truncated =
    markerIndex === -1 ? content : content.slice(0, markerIndex);

  return truncated
    .replaceAll(END_OF_RESPONSE_MARKER, "")
    .replace(/\[PROGRESS[^\]]*\]?/g, "")
    .replace(/\[META[^\]]*\]?/g, "")
    .trim();
};
