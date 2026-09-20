export {};

declare global {
  interface CloudflareEnv {
    AI_JOBS?: {
      send(message: unknown): Promise<void>;
    };
    CRON_SECRET?: string;
    NEXT_PUBLIC_BASE_URL?: string;
  }
}
