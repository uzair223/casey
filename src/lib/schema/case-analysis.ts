import { z } from "zod";

export const CaseAnalysisSourceRefSchema = z
  .object({
    statementId: z.string().trim().min(1),
    witnessName: z.string().trim().min(1),
    sectionId: z.string().trim().nullable(),
    exhibitId: z.string().trim().nullable().optional(),
    evidenceName: z.string().trim().nullable().optional(),
    excerpt: z.string().trim().min(1),
  })
  .strict();

export const CaseAnalysisSchema = z
  .object({
    executiveSummary: z
      .string()
      .trim()
      .describe(
        "A concise neutral summary of what the supplied witness statements collectively say. Do not decide what is true.",
      ),
    chronology: z.array(
      z
        .object({
          dateOrTime: z.string().trim().nullable(),
          event: z.string().trim().min(1),
          sources: z.array(CaseAnalysisSourceRefSchema).min(1),
          conflicts: z.array(z.string().trim().min(1)).default([]),
        })
        .strict(),
    ),
    agreedFacts: z.array(
      z
        .object({
          fact: z.string().trim().min(1),
          sources: z.array(CaseAnalysisSourceRefSchema).min(1),
        })
        .strict(),
    ),
    disputedFacts: z.array(
      z
        .object({
          issue: z.string().trim().min(1),
          positions: z
            .array(
              z
                .object({
                  summary: z.string().trim().min(1),
                  sources: z.array(CaseAnalysisSourceRefSchema).min(1),
                })
                .strict(),
            )
            .min(1),
          suggestedFollowUps: z.array(z.string().trim().min(1)).default([]),
        })
        .strict(),
    ),
    missingInformation: z.array(
      z
        .object({
          gap: z.string().trim().min(1),
          whyItMatters: z.string().trim().min(1),
          suggestedFollowUps: z.array(z.string().trim().min(1)).default([]),
        })
        .strict(),
    ),
    evidenceMentioned: z.array(
      z
        .object({
          evidence: z
            .string()
            .trim()
            .min(1)
            .describe(
              "Evidence document, exhibit, uploaded file, or evidence item mentioned by a statement or supplied as supporting evidence. Include the document name when known.",
            ),
          mentionedBy: z.array(CaseAnalysisSourceRefSchema).min(1),
          uploadedOrAvailable: z.boolean().nullable(),
        })
        .strict(),
    ),
    caseThemes: z.array(
      z
        .object({
          theme: z.string().trim().min(1),
          supportingFacts: z.array(z.string().trim().min(1)).default([]),
          weaknesses: z.array(z.string().trim().min(1)).default([]),
        })
        .strict(),
    ),
  })
  .strict();

export const CaseAnalysisSourceVersionSchema = z
  .object({
    statementId: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1),
  })
  .strict();

export type CaseAnalysis = z.infer<typeof CaseAnalysisSchema>;
export type CaseAnalysisSourceRef = z.infer<typeof CaseAnalysisSourceRefSchema>;
export type CaseAnalysisSourceVersion = z.infer<
  typeof CaseAnalysisSourceVersionSchema
>;
