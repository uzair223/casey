import { createClient } from "@supabase/supabase-js";
import { Database } from "../../types/supabase.generated";
import { assertServerOnly } from "../utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";

export const getServiceClient = (source?: string) => {
  assertServerOnly(source);
  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL.");
  }

  return createClient<Database>(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
