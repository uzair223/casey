import { StatementConfig } from "@/types";
import { z } from "zod";

export function ResponseMetadataSchema(statementConfig: StatementConfig) {
  return z
    .object({
      witnessDetails: statementConfig.witness_metadata_fields
        ? z
            .object(
              Object.fromEntries(
                statementConfig.witness_metadata_fields.map((v) => {
                  let s = z.string().trim().nullable();
                  if (v.description) s = s.describe(v.description);
                  return [v.id, s];
                }),
              ),
            )
            .strict()
            .nullable()
        : z.null(),
      progress: z
        .object({
          currentPhase: z
            .enum(statementConfig.phases.map((p) => p.id))
            .describe("phase of the assistant's latest line of questioning"),
          overallCompletion: z
            .number()
            .min(0)
            .max(100)
            .describe("overall completion of the witness intake"),
          phaseCompleteness: z
            .object(
              Object.fromEntries(
                statementConfig.phases.map((p) => [
                  p.id,
                  z.number().min(0).max(100),
                ]),
              ),
            )
            .strict()
            .describe("completion of each specific phase"),
          readyToPrepare: z.boolean(),
        })
        .strict(),
      ignoredMissingDetails: z
        .array(z.string())
        .nullable()
        .describe(
          "missing details that were ignored for the sake of progression",
        ),
      evidence: z
        .object({
          record: z
            .array(
              z
                .object({
                  name: z
                    .string()
                    .trim()
                    .describe("short description of evidence required"),
                  type: z.string().trim().describe("mime-type"),
                })
                .strict(),
            )
            .describe("record of all the requested evidence"),
          requestedEvidence: z
            .object({
              name: z.string(),
              type: z.string(),
            })
            .strict()
            .nullable()
            .describe(
              "evidence/documentation being requested in the assistant's latest line of questioning",
            ),
        })
        .strict(),
      deviation: z
        .object({
          stopIntake: z
            .boolean()
            .describe("flag to stop conversation from continuing"),
          flaggedDeviation: z
            .boolean()
            .describe("flag for whether conversation has started deviating"),
          deviationReason: z.string(),
        })
        .strict()
        .nullable(),
    })
    .strict();
}

export type ResponseMetadata = z.infer<
  ReturnType<typeof ResponseMetadataSchema>
>;
