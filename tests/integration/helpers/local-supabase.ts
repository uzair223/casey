import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase.generated";

type LocalSupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

type TestUserInput = {
  email: string;
  password: string;
  role: Database["public"]["Tables"]["profiles"]["Row"]["role"];
  tenantId: string | null;
  displayName: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function hasLocalSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}

export function getLocalSupabaseEnv(): LocalSupabaseEnv {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SECRET_KEY"),
  };
}

export function createAnonClient(): SupabaseClient<Database> {
  const env = getLocalSupabaseEnv();

  return createClient<Database>(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServiceClient(): SupabaseClient<Database> {
  const env = getLocalSupabaseEnv();

  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function signInAs(email: string, password: string) {
  const client = createAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw error ?? new Error(`Failed to sign in as ${email}`);
  }

  return client;
}

export async function createTestUser(
  service: SupabaseClient<Database>,
  input: TestUserInput,
) {
  const { data, error } = await service.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      display_name: input.displayName,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user for ${input.email}`);
  }

  const { error: profileError } = await service.from("profiles").insert({
    user_id: data.user.id,
    tenant_id: input.tenantId,
    role: input.role,
    display_name: input.displayName,
  });

  if (profileError) {
    throw profileError;
  }

  return data.user;
}
