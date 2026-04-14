import { z } from "zod";

export const CaseStatusSchema = z.enum([
  "draft",
  "in_progress",
  "submitted",
  "locked",
]);

export const CaseSchema = z.object({
  title: z.string().trim().min(1, "Case name is required"),
  incident_date: z.string().trim().optional(),
  case_template_id: z.uuid().nullable().optional(),
  case_metadata: z.record(z.string(), z.string().nullable()).optional(),
  assigned_to_ids: z.array(z.string().uuid()).optional(),
  status: CaseStatusSchema,
});

export type CaseSchema = z.infer<typeof CaseSchema>;
