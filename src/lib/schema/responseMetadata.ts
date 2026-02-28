import { z } from "zod";

export const ResponseMetadataSchema = z.object({
  witnessDetails: z
    .object({
      address: z.string().trim().nullable().optional(),
      occupation: z.string().trim().nullable().optional(),
    })
    .optional(),
  progress: z.object({
    currentPhase: z.number(),
    overallCompletion: z.number(),
    completedPhases: z.array(z.number()),
    phaseCompleteness: z.record(z.string(), z.number()),
    readyToPrepare: z.boolean(),
  }),
  ignoredMissingDetails: z.array(z.string()).optional().default([]),
  evidence: z.object({
    record: z
      .array(
        z.object({
          name: z.string().trim(),
          type: z.string().trim(),
        }),
      )
      .default([]),
    currentAsk: z
      .object({
        name: z.string(),
        type: z.string(),
      })
      .nullable()
      .optional(),
  }),
  deviation: z
    .object({
      stopIntake: z.boolean(),
      flaggedDeviation: z.boolean(),
      deviationReason: z.string(),
    })
    .nullable()
    .optional(),
});

export type ResponseMetadataSchemaType = z.infer<typeof ResponseMetadataSchema>;
