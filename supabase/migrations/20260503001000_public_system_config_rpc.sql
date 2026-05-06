-- Expose system config access through public SECURITY DEFINER RPCs
-- This keeps app_private hidden while allowing server-side access through the exposed public schema.
-- Date: 2026-05-03

CREATE OR REPLACE FUNCTION public.get_system_config(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app_private, pg_temp
AS $$
  SELECT value
  FROM app_private.system_config
  WHERE key = p_key
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_system_config(p_key TEXT, p_value TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app_private, pg_temp
AS $$
  INSERT INTO app_private.system_config (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at;
$$;

CREATE OR REPLACE FUNCTION public.list_system_config()
RETURNS TABLE (
  key TEXT,
  value TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app_private, pg_temp
AS $$
  SELECT
    c.key,
    c.value,
    c.updated_at
  FROM app_private.system_config c
  ORDER BY c.key;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_config(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_system_config(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_system_config() TO service_role;
