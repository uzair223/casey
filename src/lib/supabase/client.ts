import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types.generated";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient<Database> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase env variables");
  }

  if (!client) {
    client = createClient(supabaseUrl, supabasePublishableKey);
  }

  return client;
};
