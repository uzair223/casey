import { z } from "zod";

const parsePositiveInt = (fallback: number) => (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const nonEmpty = z.string().trim().min(1);
const stringOrEmpty = z.string().trim().optional().default("");

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),

  NEXT_PUBLIC_APP_NAME: z.string().trim().default("Casey"),
  NEXT_PUBLIC_BASE_URL: z.string().trim().default("http://localhost:3000"),
  NEXT_PUBLIC_VERCEL_URL: z.string().trim().optional().default(""),

  NEXT_PUBLIC_SUPABASE_URL: stringOrEmpty,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stringOrEmpty,
  SUPABASE_SECRET_KEY: stringOrEmpty,

  RESEND_API_KEY: stringOrEmpty,
  RESEND_FROM: stringOrEmpty,

  OPENROUTER_API_KEY: stringOrEmpty,
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

  AXIOM_TOKEN: z.string().trim().optional().default(""),
  AXIOM_DATASET: z.string().trim().optional().default(""),
  AXIOM_BASE_URL: z.string().trim().default("https://api.axiom.co"),
});

export const BuildEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  NEXT_PUBLIC_APP_NAME: nonEmpty,
  NEXT_PUBLIC_BASE_URL: nonEmpty,
  NEXT_PUBLIC_VERCEL_URL: z.string().trim().optional(),
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmpty,
  SUPABASE_SECRET_KEY: nonEmpty,
  RESEND_API_KEY: nonEmpty,
  RESEND_FROM: nonEmpty,
  OPENROUTER_API_KEY: nonEmpty,
  OPENROUTER_MODEL: nonEmpty,
  FORMALIZE_MAX_USER_TURNS: z.string().optional(),
  FORMALIZE_MAX_CHARS_PER_TURN: z.string().optional(),
  FORMALIZE_TIMEOUT_MS: z.string().optional(),
  FORMALIZE_MAX_ATTEMPTS: z.string().optional(),
  CRON_SECRET: z.string().trim().optional(),
  AXIOM_TOKEN: z.string().trim().optional(),
  AXIOM_DATASET: z.string().trim().optional(),
  AXIOM_BASE_URL: z.string().trim().optional(),
});

const envInput = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  FORMALIZE_MAX_USER_TURNS: process.env.FORMALIZE_MAX_USER_TURNS,
  FORMALIZE_MAX_CHARS_PER_TURN: process.env.FORMALIZE_MAX_CHARS_PER_TURN,
  FORMALIZE_TIMEOUT_MS: process.env.FORMALIZE_TIMEOUT_MS,
  FORMALIZE_MAX_ATTEMPTS: process.env.FORMALIZE_MAX_ATTEMPTS,
  CRON_SECRET: process.env.CRON_SECRET,
  AXIOM_TOKEN: process.env.AXIOM_TOKEN,
  AXIOM_DATASET: process.env.AXIOM_DATASET,
  AXIOM_BASE_URL: process.env.AXIOM_BASE_URL,
};

export const env = EnvSchema.parse(envInput);
