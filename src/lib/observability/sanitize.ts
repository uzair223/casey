const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "set-cookie",
  "openrouter_api_key",
  "supabase_secret_key",
];

const MAX_STRING_LENGTH = 2_000;
const MAX_ARRAY_LENGTH = 50;
const MAX_OBJECT_KEYS = 50;
const MAX_DEPTH = 5;

function shouldRedact(key: string): boolean {
  const normalized = key.toLowerCase();
  return REDACTED_KEYS.some((sensitive) => normalized.includes(sensitive));
}

function sanitizeString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

export function sanitizeForLogging(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return "[depth-limited]";
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: sanitizeString(value.stack ?? ""),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => {
      return sanitizeForLogging(item, depth + 1);
    });
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );

    return Object.fromEntries(
      entries.map(([key, nestedValue]) => {
        if (shouldRedact(key)) {
          return [key, "[REDACTED]"];
        }

        return [key, sanitizeForLogging(nestedValue, depth + 1)];
      }),
    );
  }

  return String(value);
}
