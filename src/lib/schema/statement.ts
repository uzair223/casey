import { z } from "zod";

export const StatementSchema = z.object({
  title: z.string().min(2).trim(),
  tenant_id: z.string().min(2).trim(),
  reference: z.string().min(2).trim(),
  claim_number: z
    .string()
    .trim()
    .nullable()
    .transform((x) => x || null),
  witness_name: z.string().min(2).trim(),
  witness_email: z.email().trim(),
  witness_address: z
    .string()
    .trim()
    .nullable()
    .transform((x) => x || null),
  witness_occupation: z
    .string()
    .trim()
    .nullable()
    .transform((x) => x || null),
  incident_date: z
    .string()
    .trim()
    .nullable()
    .transform((x) => x || null),
  status: z
    .enum(["draft", "in_progress", "submitted", "locked"])
    .default("draft"),
});

export type StatementSchemaType = z.infer<typeof StatementSchema>;
export type UpdateStatementSchemaType = Partial<
  Omit<StatementSchemaType, "tenant_id">
>;
