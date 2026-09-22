import { z } from "zod";

export const CaseFieldConfigSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    type: z.enum(["text", "number", "date"]).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    description: z
      .string()
      .trim()
      .optional()
      .describe(
        "What this fact is and why it matters. Case analysis reads this beside the stored value.",
      ),
  })
  .strict();

export const CaseConfigSchema = z
  .object({
    matterBrief: z
      .string()
      .trim()
      .nullable()
      .optional()
      .describe(
        "What kind of matter this is and what case analysis should weigh. The analysis model treats this as the review brief.",
      ),
    dynamicFields: z.array(CaseFieldConfigSchema).default([]),
  })
  .strict();

export type CaseFieldConfig = z.infer<typeof CaseFieldConfigSchema>;
export type CaseConfig = z.infer<typeof CaseConfigSchema>;
