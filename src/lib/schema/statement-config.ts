import { z } from "zod";

const AGENT_CHAT_DESCRIPTION = `Define the role of the conversational agent conducting the one-to-one witness interview.
Start with "You are..."
Focus on guiding the witness through a structured, neutral, and thorough account without leading or suggesting answers.`;

const AGENT_FORMALIZE_DESCRIPTION = `Define the role of the agent responsible for converting interview transcripts into a formal witness statement.
Start with "You are..."
Focus on producing a clear, accurate, and legally structured narrative that preserves the witness's wording and intent.`;

const PHASES_DESCRIPTION = `Generate 4-10 structured conversational phases for a one-to-one witness or claimant interview based on the inferred case type.

The user input may describe any scenario (e.g. workplace injury, road traffic accident, medical negligence, public liability). You must infer the domain and generate an appropriate investigative structure.

Each phase must represent a distinct evidential area of inquiry that supports open-ended questioning and contributes to building a complete factual account.

Phases must:
- Be high-level and reusable across similar case types
- Represent investigative domains rather than event steps or timelines
- Enable structured conversation without being prescriptive or scripted
- Avoid overlapping in purpose or scope

Each phase must include:
- A domain-level title
- A description of what information is explored within that domain
- An objective describing the evidential purpose of that phase

Phases should collectively form a complete investigative framework for understanding what happened, its context, its consequences, and relevant supporting information.

Constraints:
- Do NOT follow any fixed template structure (including RTA-style or injury-style sequences)
- Do NOT generate timeline-based or micro-event phases
- Do NOT assume any default case type structure
- Do NOT include administrative or metadata collection phases

The output should represent a flexible investigative model that adapts to the case type while remaining structurally consistent.`;

const SECTIONS_DESCRIPTION = `Define structured sections for a formal witness statement.

Each section represents a distinct component of the final legal statement and must together form a complete, coherent narrative suitable for legal or claims processing.

Each section must:
- Represent a single evidential function within the final statement
- Be written as a static document section (not an interview flow)
- Be reusable across different case types without relying on fixed templates
- Avoid duplication of information across sections

Sections should be derived from the case content rather than a predefined list. The structure must adapt dynamically based on the nature of the incident described in the input.

Each section must include:
- A clear title representing its evidential function
- A description of what the section contains

Constraints:
- DO NOT use predefined templates (e.g. RTA, workplace injury, or medical negligence structures)
- DO NOT assume any default section ordering or naming conventions
- DO NOT include metadata or administrative information
- DO NOT merge multiple evidential functions into a single section
- DO NOT mirror interview phases or question flow

Each section should read as a finalized part of a legal witness statement intended for formal review.`;

const METADATA_DESCRIPTION = `Define structured metadata fields that capture contextual witness attributes used to support interpretation of the statement.

These fields describe factual, non-narrative attributes of the witness that provide context for evaluating their account (e.g. occupation, role, relationship to parties, contextual exposure).

Requirements:
- Each field must represent a single atomic factual attribute
- Fields must support contextual understanding of credibility, perspective, or relevance
- Fields must remain separate from the narrative statement content

Constraints:
- NEVER include name or contact information (already collected)
- NEVER include narrative or event description content
- Avoid overlap with statement sections or interview phases

Ensure all fields are structured, minimal, and strictly contextual in nature.`;

export const StatementPhaseConfigSchema = z
  .object({
    id: z.string().trim().min(1).describe("camelCase phase identifier"),

    title: z
      .string()
      .trim()
      .min(1)
      .describe(
        "High-level domain label for the phase (e.g. 'Incident Narrative', 'Medical Treatment'). Must represent a broad evidential category, not a question or micro-topic.",
      ),

    description: z
      .string()
      .describe(
        "Explains what information is explored within this phase. Must describe an open-ended area of inquiry, not a scripted set of questions or events.",
      ),

    allowedTopics: z
      .array(z.string())
      .nullable()
      .describe(
        "Optional list of topics that are relevant within this phase. Should define the boundaries of acceptable discussion within the evidential domain.",
      ),

    forbiddenTopics: z
      .array(z.string())
      .nullable()
      .describe(
        "Optional list of topics that must not be covered in this phase. Used to prevent overlap with other phases or irrelevant diversion.",
      ),

    completionCriteria: z
      .array(z.string())
      .nullable()
      .describe(
        "Conditions that indicate sufficient information has been gathered for this phase. Should describe evidential completeness, not conversational closure.",
      ),

    questioningMode: z
      .enum(["narrative", "structured", "mixed"])
      .nullable()
      .describe(
        "Defines how information should be elicited: narrative (free account), structured (targeted prompts), or mixed (combination depending on detail gaps).",
      ),
  })
  .strict();

export const StatementSectionConfigSchema = z
  .object({
    id: z.string().trim().min(1).describe("camelCase section identifier"),

    title: z
      .string()
      .trim()
      .min(1)
      .describe(
        "Formal section title for the final witness statement. Must represent a distinct evidential component (e.g. 'Accident Description', 'Medical Treatment').",
      ),

    description: z
      .string()
      .nullable()
      .describe(
        "Defines the content scope of this section in the final written statement. Must describe what is included in this section, not how to ask about it.",
      ),
  })
  .strict();

export const StatementMetadataFieldConfigSchema = z
  .object({
    id: z.string().trim().min(1).describe("camelCase identifier"),

    label: z
      .string()
      .trim()
      .min(1)
      .describe("Human-readable label for the metadata field"),

    description: z
      .string()
      .nullable()
      .describe(
        "Optional explanation of what this field captures and why it is relevant to the statement",
      ),

    requiredOnIntake: z
      .boolean()
      .nullable()
      .describe(
        "should ONLY be true if the field must be known early in the interview to proceed meaningfully",
      ),

    requiredOnCreate: z
      .boolean()
      .nullable()
      .describe(
        "should ONLY be true if the field is essential before the interview begins (e.g. needed to route or initialise the case)",
      ),
  })
  .strict();
export const StatementPromptTemplatesSchema = z
  .object({
    chat_system_template: z.string(),
    metadata_system_template: z.string(),
    formalize_system_template: z.string(),
  })
  .strict();

export const StatementConfigSchema = z
  .object({
    agents: z
      .object({
        chat: z.string().describe(AGENT_CHAT_DESCRIPTION),
        formalize: z.string().describe(AGENT_FORMALIZE_DESCRIPTION),
      })
      .strict(),

    phases: z.array(StatementPhaseConfigSchema).describe(PHASES_DESCRIPTION),

    sections: z
      .array(StatementSectionConfigSchema)
      .describe(SECTIONS_DESCRIPTION),

    witness_metadata_fields: z
      .array(StatementMetadataFieldConfigSchema)
      .describe(METADATA_DESCRIPTION),

    case_metadata_deps: z.array(z.string()),
    prompts: StatementPromptTemplatesSchema.nullable(),
  })
  .strict();

export const StatementConfigPublishSchema = StatementConfigSchema.superRefine(
  (config, ctx) => {
    if (!config.agents.chat.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["agents", "chat"],
        message: "Agent chat prompt is required.",
      });
    }

    if (!config.agents.formalize.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["agents", "formalize"],
        message: "Agent formalize prompt is required.",
      });
    }

    if (config.phases.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["phases"],
        message: "Interview phases must not be empty.",
      });
    }

    if (config.sections.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: "Document sections must not be empty.",
      });
    }

    const sectionIdSet = new Set<string>();
    config.sections.forEach((section, index) => {
      const id = section.id.trim();
      const title = section.title.trim();

      if (!title) {
        ctx.addIssue({
          code: "custom",
          path: ["sections", index, "title"],
          message: "Every section must have a title.",
        });
      }

      if (!id) {
        ctx.addIssue({
          code: "custom",
          path: ["sections", index, "id"],
          message: "Every section must have an id.",
        });
        return;
      }

      if (sectionIdSet.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["sections", index, "id"],
          message: "Section ids must be unique.",
        });
      }

      sectionIdSet.add(id);
    });

    const witnessFieldSet = new Set<string>();
    config.witness_metadata_fields.forEach((field, index) => {
      const key = field.id.trim();
      const label = field.label.trim();

      if (!key || !label) {
        ctx.addIssue({
          code: "custom",
          path: ["witness_metadata_fields", index],
          message: "Witness metadata fields require both id and label.",
        });
        return;
      }

      if (witnessFieldSet.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["witness_metadata_fields", index, "id"],
          message: "Witness metadata field id must be unique.",
        });
      }

      witnessFieldSet.add(key);
    });

    config.case_metadata_deps.forEach((dep, index) => {
      if (!dep.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["case_metadata_deps", index],
          message: "Case metadata dependencies cannot contain blank values.",
        });
      }
    });
  },
);

export type StatementPhaseConfig = z.infer<typeof StatementPhaseConfigSchema>;
export type StatementSectionConfig = z.infer<
  typeof StatementSectionConfigSchema
>;
export type StatementMetadataFieldConfig = z.infer<
  typeof StatementMetadataFieldConfigSchema
>;
export type StatementPromptTemplates = z.infer<
  typeof StatementPromptTemplatesSchema
>;
export type StatementConfig = z.infer<typeof StatementConfigSchema>;
