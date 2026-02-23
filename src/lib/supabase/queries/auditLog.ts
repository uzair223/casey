import { getSupabaseClient } from "../client";

/**
 * Log an intake access attempt for audit trail
 * Should be called for all intake-related access
 */
export async function logStatementAccess(params: {
  token: string;
  table: string;
  id?: string;
  granted: boolean;
  error?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.rpc("log_intake_access" as any, {
      p_token: params.token,
      p_table: params.table,
      p_id: params.id || null,
      p_ip_address: null, // Will be set server-side from headers if needed
      p_user_agent:
        typeof window !== "undefined" ? window.navigator.userAgent : null,
      p_granted: params.granted,
      p_error: params.error || null,
    });
  } catch (error) {
    // Don't throw on logging errors - we don't want to break the app
    console.error("Failed to log intake access:", error);
  }
}

/**
 * Check rate limit before allowing access
 * Returns whether access should be allowed
 */
export async function checkStatementRateLimit(params: {
  token?: string;
  ipAddress?: string;
}): Promise<{
  allowed: boolean;
  attemptsCount: number;
  windowExpiresAt: string | null;
}> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "check_intake_rate_limit" as any,
      {
        p_token: params.token || null,
        p_ip_address: params.ipAddress || null,
        p_max_attempts: 10,
        p_window_minutes: 5,
      },
    );

    if (error) {
      console.error("Rate limit check failed:", error);
      // Fail open - allow access if check fails
      return { allowed: true, attemptsCount: 0, windowExpiresAt: null };
    }

    const result = data?.[0];
    return {
      allowed: result?.allowed ?? true,
      attemptsCount: result?.attempts_count ?? 0,
      windowExpiresAt: result?.window_expires_at ?? null,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Fail open
    return { allowed: true, attemptsCount: 0, windowExpiresAt: null };
  }
}

/**
 * Get access statistics (for admin monitoring)
 */
export async function getAccessStats(hours: number = 24): Promise<{
  totalAttempts: number;
  grantedAttempts: number;
  deniedAttempts: number;
  uniqueIps: number;
  uniqueTokens: number;
} | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("get_access_stats" as any, {
      p_hours: hours,
    });

    if (error) {
      console.error("Failed to get access stats:", error);
      return null;
    }

    const result = data?.[0];
    return result
      ? {
          totalAttempts: Number(result.total_attempts || 0),
          grantedAttempts: Number(result.granted_attempts || 0),
          deniedAttempts: Number(result.denied_attempts || 0),
          uniqueIps: Number(result.unique_ips || 0),
          uniqueTokens: Number(result.unique_tokens || 0),
        }
      : null;
  } catch (error) {
    console.error("Error getting access stats:", error);
    return null;
  }
}
