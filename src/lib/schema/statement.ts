import { z } from "zod";
import type { UploadedDocument } from "@/types";

export const StatementSchema = z.object({
  title: z.string().min(2).trim(),
  tenant_id: z.string().min(2).trim(),
  witness_name: z.string().min(2).trim(),
  witness_email: z.email().trim(),
  witness_metadata: z.record(z.string(), z.string().nullable()).optional(),
  status: z
    .enum([
      "draft",
      "in_progress",
      "submitted",
      "finalized",
      "completed",
      "locked",
      "demo",
      "demo_published",
    ])
    .default("draft"),
  sections: z.record(z.string(), z.string()).optional(),
});

export const UpdateStatementSchema = StatementSchema.omit({
  tenant_id: true,
}).partial();

export type StatementSchemaType = z.infer<typeof StatementSchema>;
export type UpdateStatementSchemaType = Partial<
  Omit<StatementSchemaType, "tenant_id">
> & {
  sections?: Record<string, string>;
  witness_metadata?: Record<string, string | null>;
  signed_document?: UploadedDocument | null;
  supporting_documents?: UploadedDocument[];
};
