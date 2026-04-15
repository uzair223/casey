import { z } from "zod";

const parsePositiveInt = (fallback: number) => (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const required = z.string().trim().min(1);

export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),

  NEXT_PUBLIC_APP_NAME: z.string().trim().default("Casey"),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_VERCEL_URL: z.url().optional(),
  NEXT_PUBLIC_BASE_URL: z.url().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required,
  SUPABASE_SECRET_KEY: required,

  RESEND_API_KEY: required,
  RESEND_FROM: required,

  OPENROUTER_API_KEY: required,
  OPENROUTER_MODEL: z.string().trim().default("openai/gpt-4o-mini"),

  FORMALIZE_MAX_USER_TURNS: z
    .string()
    .optional()
    .transform(parsePositiveInt(40)),
  FORMALIZE_MAX_CHARS_PER_TURN: z
    .string()
    .optional()
    .transform(parsePositiveInt(1200)),
  FORMALIZE_TIMEOUT_MS: z
    .string()
    .optional()
    .transform(parsePositiveInt(45000)),
  FORMALIZE_MAX_ATTEMPTS: z.string().optional().transform(parsePositiveInt(3)),

  CRON_SECRET: z.string().trim().optional(),

  AXIOM_TOKEN: z.string().trim().optional(),
  AXIOM_DATASET: z.string().trim().optional(),
  AXIOM_BASE_URL: z.url().trim().default("https://api.axiom.co"),
});

export const env = EnvSchema.parse(process.env);
