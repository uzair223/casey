import { env } from "../env";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../../types/supabase.generated";
import { assertServerOnly } from "../utils";
import { createSupabaseLoggedFetch } from "./logging-fetch";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;

export const getServiceClient = (source?: string) => {
  assertServerOnly(source);
  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL.");
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: createSupabaseLoggedFetch("service-client", source),
    },
  });
};
