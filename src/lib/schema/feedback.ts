import { z } from "zod";

export const WitnessSurveySchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, "Choose a rating from 1 to 5.")
    .max(5, "Choose a rating from 1 to 5."),
  message: z
    .string()
    .trim()
    .max(2000, "Keep comments under 2000 characters.")
    .optional()
    .transform((value) => value || undefined),
});

export const FirmFeedbackSchema = z.object({
  kind: z.enum(["bug", "idea"]),
  message: z
    .string()
    .trim()
    .min(1, "Please add a short description.")
    .max(2000, "Keep comments under 2000 characters."),
  pagePath: z
    .string()
    .trim()
    .max(200, "Page path is too long.")
    .optional()
    .transform((value) => value || undefined),
});

export type WitnessSurveySchemaType = z.infer<typeof WitnessSurveySchema>;
export type FirmFeedbackSchemaType = z.infer<typeof FirmFeedbackSchema>;
