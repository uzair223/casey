import { z } from "zod";
import type { StatementConfig } from "@/types";

export const StatementConfigIdSchema = z.string().trim().min(1);

function getMetadataFieldSchema(label: string, isRequired: boolean) {
  const base = z.string().trim();
  if (isRequired) {
    return base.min(1, `${label} is required`);
  }

  return base.optional();
}

function buildMetadataObjectSchema(
  config: StatementConfig,
  requiredSelector: (field: {
    requiredOnIntake?: boolean | null;
    requiredOnCreate?: boolean | null;
  }) => boolean,
) {
  const metadataShape: Record<string, z.ZodTypeAny> = {};

  for (const field of config.witness_metadata_fields ?? []) {
    metadataShape[field.id] = getMetadataFieldSchema(
      field.label,
      requiredSelector(field),
    );
  }

  return z.object(metadataShape);
}

export function buildCreateWitnessSchema(config: StatementConfig) {
  return z.object({
    witness_name: z.string().trim().min(1, "Witness name is required"),
    witness_email: z.string().trim(), //.email("Enter a valid email"),
    witness_metadata: buildMetadataObjectSchema(
      config,
      (field) => field.requiredOnCreate ?? field.requiredOnIntake ?? false,
    ),
    template_id: StatementConfigIdSchema,
  });
}

export function buildUpdateWitnessDetailsSchema(config: StatementConfig) {
  return z.object({
    status: z.enum([
      "draft",
      "in_progress",
      "submitted",
      "finalized",
      "completed",
      "locked",
      "demo",
      "demo_published",
    ]),
    witness_name: z.string().trim().min(1, "Witness name is required"),
    witness_email: z.email("Enter a valid email").trim(),
    witness_metadata: buildMetadataObjectSchema(
      config,
      (field) => field.requiredOnCreate ?? field.requiredOnIntake ?? false,
    ),
  });
}

export type CreateWitnessFormData = {
  witness_name: string;
  witness_email: string;
  witness_metadata: Record<string, unknown>;
  template_id: z.infer<typeof StatementConfigIdSchema>;
};

export type UpdateWitnessDetailsFormData = {
  status:
    | "draft"
    | "in_progress"
    | "submitted"
    | "finalized"
    | "completed"
    | "locked"
    | "demo"
    | "demo_published";
  witness_name: string;
  witness_email: string;
  witness_metadata: Record<string, unknown>;
};
