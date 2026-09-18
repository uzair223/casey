import { z } from "zod";

const parsePositiveInt = (fallback: number) => (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const nonEmpty = z.string().trim().min(1);
const stringOrEmpty = z.string().trim().optional().default("");

export const EnvSchema = z.looseObject({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),

  NEXT_PUBLIC_APP_NAME: z.string().trim().default("Casey"),
  NEXT_PUBLIC_BASE_URL: z.string().trim().default("http://localhost:3000"),
  NEXT_PUBLIC_DOCUSEAL_URL: stringOrEmpty,

  NEXT_PUBLIC_SUPABASE_URL: stringOrEmpty,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stringOrEmpty,
  SUPABASE_SECRET_KEY: stringOrEmpty,

  RESEND_API_KEY: stringOrEmpty,
  RESEND_FROM: stringOrEmpty,
  NEXT_PUBLIC_SUPPORT_EMAIL: stringOrEmpty,
  NEXT_PUBLIC_CALENDLY_LINK: stringOrEmpty,

  CLOUDFLARE_AI_ACCOUNT_ID: stringOrEmpty,
  CLOUDFLARE_AI_API_TOKEN: stringOrEmpty,
  CLOUDFLARE_AI_GATEWAY_ID: stringOrEmpty,

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

  CRON_SECRET: stringOrEmpty,
  CSP_ENFORCE: stringOrEmpty,

  STRIPE_SECRET_KEY: stringOrEmpty,
  STRIPE_WEBHOOK_SECRET: stringOrEmpty,
  STRIPE_SEAT_PRICE_ID: stringOrEmpty,

  DOCUSEAL_URL: stringOrEmpty,
  DOCUSEAL_API_KEY: stringOrEmpty,
  DOCUSEAL_WEBHOOK_SECRET: stringOrEmpty,

  AXIOM_TOKEN: stringOrEmpty,
  AXIOM_DATASET: stringOrEmpty,
  AXIOM_BASE_URL: z.string().trim().optional().default("https://api.axiom.co"),
});

export const BuildEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  NEXT_PUBLIC_APP_NAME: nonEmpty,
  NEXT_PUBLIC_BASE_URL: nonEmpty,
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmpty,
  SUPABASE_SECRET_KEY: nonEmpty,
  RESEND_API_KEY: nonEmpty,
  RESEND_FROM: nonEmpty,
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().optional(),
  NEXT_PUBLIC_CALENDLY_LINK: z.string().optional(),
  CLOUDFLARE_AI_ACCOUNT_ID: nonEmpty,
  CLOUDFLARE_AI_API_TOKEN: nonEmpty,
  CLOUDFLARE_AI_GATEWAY_ID: z.string().trim().optional(),
  FORMALIZE_MAX_USER_TURNS: z.string().optional(),
  FORMALIZE_MAX_CHARS_PER_TURN: z.string().optional(),
  FORMALIZE_TIMEOUT_MS: z.string().optional(),
  FORMALIZE_MAX_ATTEMPTS: z.string().optional(),
  CRON_SECRET:
    process.env.NODE_ENV === "production" ? nonEmpty : z.string().trim().optional(),
  CSP_ENFORCE: z.string().trim().optional(),
  STRIPE_SECRET_KEY: z.string().trim().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().trim().optional(),
  STRIPE_SEAT_PRICE_ID: z.string().trim().optional(),
  NEXT_PUBLIC_DOCUSEAL_URL: z.string().trim().optional(),
  DOCUSEAL_URL: z.string().trim().optional(),
  DOCUSEAL_API_KEY: z.string().trim().optional(),
  DOCUSEAL_WEBHOOK_SECRET: z.string().trim().optional(),
  AXIOM_TOKEN: z.string().trim().optional(),
  AXIOM_DATASET: z.string().trim().optional(),
  AXIOM_BASE_URL: z.string().trim().optional(),
});

const envInput = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_DOCUSEAL_URL: process.env.NEXT_PUBLIC_DOCUSEAL_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  NEXT_PUBLIC_CALENDLY_LINK: process.env.NEXT_PUBLIC_CALENDLY_LINK,
  CLOUDFLARE_AI_ACCOUNT_ID: process.env.CLOUDFLARE_AI_ACCOUNT_ID,
  CLOUDFLARE_AI_API_TOKEN: process.env.CLOUDFLARE_AI_API_TOKEN,
  CLOUDFLARE_AI_GATEWAY_ID: process.env.CLOUDFLARE_AI_GATEWAY_ID,
  FORMALIZE_MAX_USER_TURNS: process.env.FORMALIZE_MAX_USER_TURNS,
  FORMALIZE_MAX_CHARS_PER_TURN: process.env.FORMALIZE_MAX_CHARS_PER_TURN,
  FORMALIZE_TIMEOUT_MS: process.env.FORMALIZE_TIMEOUT_MS,
  FORMALIZE_MAX_ATTEMPTS: process.env.FORMALIZE_MAX_ATTEMPTS,
  CRON_SECRET: process.env.CRON_SECRET,
  CSP_ENFORCE: process.env.CSP_ENFORCE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_SEAT_PRICE_ID: process.env.STRIPE_SEAT_PRICE_ID,
  DOCUSEAL_URL: process.env.DOCUSEAL_URL,
  DOCUSEAL_API_KEY: process.env.DOCUSEAL_API_KEY,
  DOCUSEAL_WEBHOOK_SECRET: process.env.DOCUSEAL_WEBHOOK_SECRET,
  AXIOM_TOKEN: process.env.AXIOM_TOKEN,
  AXIOM_DATASET: process.env.AXIOM_DATASET,
  AXIOM_BASE_URL: process.env.AXIOM_BASE_URL,
};

export const env = EnvSchema.parse(envInput);
