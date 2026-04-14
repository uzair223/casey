import { z } from "zod";

export const StatementPhaseConfigSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string(),
  })
  .strict();

export const StatementSectionConfigSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().optional(),
  })
  .strict();

export const StatementMetadataFieldConfigSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    description: z.string().optional(),
    required: z.boolean().optional(),
    requiredOnCreate: z.boolean().optional(),
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
        chat: z.string(),
        formalize: z.string(),
      })
      .strict(),
    phases: z.array(StatementPhaseConfigSchema).default([]),
    sections: z.array(StatementSectionConfigSchema).default([]),
    witness_metadata_fields: z
      .array(StatementMetadataFieldConfigSchema)
      .default([]),
    case_metadata_deps: z.array(z.string()).default([]),
    prompts: StatementPromptTemplatesSchema.nullable().optional().default(null),
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
