import { z } from "zod";

export const CaseFieldConfigSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    type: z.enum(["text", "number", "date"]).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
  })
  .strict();

export const CaseConfigSchema = z
  .object({
    dynamicFields: z.array(CaseFieldConfigSchema).default([]),
  })
  .strict();

export type CaseFieldConfig = z.infer<typeof CaseFieldConfigSchema>;
export type CaseConfig = z.infer<typeof CaseConfigSchema>;
