import { z } from "zod";

export const WaitlistSignupSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  companyName: z.string().trim().min(1, "Company name is required."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address."),
});

export type WaitlistSignupSchemaType = z.infer<typeof WaitlistSignupSchema>;
