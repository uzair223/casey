import { getServiceClient } from "./server";

export type ConfigKey =
  | "site_url"
  | "cron_secret"
  | "default_chat_system_prompt"
  | "default_formalize_system_prompt"
  | "case_analysis_prompt";

const CONFIG_KEYS = new Set<string>([
  "site_url",
  "cron_secret",
  "default_chat_system_prompt",
  "default_formalize_system_prompt",
  "case_analysis_prompt",
]);

export function isSystemConfigKey(key: string): key is ConfigKey {
  return CONFIG_KEYS.has(key);
}

/**
 * Fetch a system configuration value from the database.
 * Falls back to environment variable or default if not found in DB.
 */
export async function getSystemConfig(key: ConfigKey): Promise<string> {
  const supabase = getServiceClient("getSystemConfig");
  const { data, error } = await supabase.rpc("get_system_config", {
    p_key: key,
  });

  if (error) {
    throw error;
  }

  if (!data) throw Error(`'${key}' is unset.`);
  return data;
}

/**
 * Set a system configuration value in the database.
 * Creates or updates the key.
 */
export async function setSystemConfig(
  key: ConfigKey,
  value: string,
): Promise<boolean> {
  try {
    const supabase = getServiceClient("setSystemConfig");
    const { error } = await supabase.rpc("set_system_config", {
      p_key: key,
      p_value: value,
    });

    if (error) {
      console.error(`Error setting system config (${key}):`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error setting system config (${key}):`, error);
    return false;
  }
}

/**
 * Fetch all system configuration values.
 */
export async function getAllSystemConfig(): Promise<Record<string, string>> {
  try {
    const supabase = getServiceClient("getAllSystemConfig");
    const { data, error } = await supabase.rpc("list_system_config");

    if (error) {
      console.error("Error fetching system config:", error);
      return {};
    }

    return Object.fromEntries(
      (data ?? []).map((item: { key: string; value: string }) => [
        item.key,
        item.value,
      ]),
    );
  } catch (error) {
    console.error("Error fetching system config:", error);
    return {};
  }
}
