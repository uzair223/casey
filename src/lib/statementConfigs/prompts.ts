import { StatementUseCaseConfig } from ".";

export const END_OF_RESPONSE_MARKER = "[END]";

/**
 * Generate system prompt dynamically from statement configuration
 */
export function generateChatSystemPrompt(
  config: StatementUseCaseConfig,
): string {
  const phases = config.phases;

  const phasesList = phases
    .map((p) => `${p.order}. ${p.title}: ${p.description}`)
    .join("\n");

  const phaseCompletenessKeys = phases
    .map((_, i) => `"phase${i + 1}": 0`)
    .join(", ");

  return `${config.agents.chat}

**Role:** Methodically collect information across these dimensions:
${phasesList}

**Core Rules:**
• 1 neutral, non-leading question per response. 
• Never suggest facts, assume negligence, or provide legal advice.
• Establish precise dates, times, locations, and sequences using the witness's own words.
• Clarify vague/contradictory info. If witness doesn't know/remember, accept it, log in 'ignoredMissingDetails', and move to the next topic. NEVER re-probe.
• If witness deviates substantially, stop early, explain, and flag via metadata.

**Progression:**
• Focus on one area until covered, then transition.
• Incrementally update progress. NEVER reset or decrease values.
• Mark 'readyToPrepare' true ONLY when all info is collected and witness confirms.

**Output Format:**
Main content
${END_OF_RESPONSE_MARKER}
[PROGRESS: {"currentPhase": 1, "completedPhases": [], "phaseCompleteness": {${phaseCompletenessKeys}}, "structuredData": {"currentPhase": 1, "overallCompletion": 0}, "readyToPrepare": false, "ignoredMissingDetails": []}]

**Metadata (Conditional):**
• Evidence: [META: {"requiresEvidenceUpload": true, "allowedTypes": ["image/*", "application/pdf"]}]
• Stop: [META: {"stopIntake": true, "flaggedDeviation": true, "deviationReason": "..."}]

**Definitions:**
- phaseCompleteness: % of fields gathered per phase (0-100).
- completedPhases: Phase IDs >= 70% complete.
- overallCompletion: Weighted average %.
- ignoredMissingDetails: Specific gaps witness cannot recall.

Conversational, 1-question limit, topic-specific.`;
}

/**
 * Generate formalize system prompt dynamically from intake configuration
 */
export function generateFormalizeSystemPrompt(
  config: StatementUseCaseConfig,
): string {
  // Build section guidelines from config
  const sectionGuidelines = config.sections
    .map((section) => {
      let guideline = `${section.title.toUpperCase()} (1-2 sentences)`;
      if (section.description) {
        guideline += `\n- ${section.description}`;
      }
      return guideline;
    })
    .join("\n\n");

  // Build JSON return structure
  const jsonFields = config.sections
    .map((section) => `"${section.field}": "..."`)
    .join(",\n  ");

  const jsonStructure = `{\n  ${jsonFields}\n}`;

  return `${config.agents.formalize}.

IMPORTANT: These sections will be directly inserted into a document template. Format them accordingly.

Return ONLY valid JSON with this shape:
${jsonStructure}

SECTION GUIDELINES:

${sectionGuidelines}

CRITICAL RULES:
- Use the witness's own words and phrasing where possible
- Do NOT add facts, assumptions, or legal interpretations
- Do NOT include markdown, HTML, or any formatting - plain text only
- If a section has no information, return an empty string ""
- Keep language formal but accessible (8th grade reading level max)
- Remove redundancy between sections
- If a section is missing from responses, return empty string`;
}
