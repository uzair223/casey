import { env } from "../env";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/supabase.generated";
import { createSupabaseLoggedFetch } from "./logging-fetch";

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient<Database> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase env variables");
  }

  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey, {
      global:
        typeof window === "undefined"
          ? {
              fetch: createSupabaseLoggedFetch("browser-client"),
            }
          : undefined,
    });
  }

  return client;
};
