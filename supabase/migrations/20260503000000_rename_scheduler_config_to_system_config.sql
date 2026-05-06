-- Rename scheduler_config to system_config for more flexible key/value storage
-- Now supports both scheduler settings and application default settings (e.g., prompt templates)
-- Date: 2026-05-03

-- Rename the table
ALTER TABLE app_private.scheduler_config RENAME TO system_config;

-- Update the function to use the new table name
CREATE OR REPLACE FUNCTION public.run_statement_reminders_job()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  site_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  SELECT c.value
  INTO site_url
  FROM app_private.system_config c
  WHERE c.key = 'site_url'
  LIMIT 1;

  SELECT c.value
  INTO cron_secret
  FROM app_private.system_config c
  WHERE c.key = 'cron_secret'
  LIMIT 1;

  IF site_url IS NULL OR site_url = '' THEN
    RAISE EXCEPTION 'Missing system config: app_private.system_config(key=site_url)';
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'Missing system config: app_private.system_config(key=cron_secret)';
  END IF;

  SELECT net.http_post(
    url := format('%s/api/internal/reminders/run', rtrim(site_url, '/')),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reminder-cron-secret', cron_secret
    ),
    body := jsonb_build_object('limit', 100)
  )
  INTO request_id;

  RETURN request_id;
END;
$$;

-- Helper function to get a config value by key
CREATE OR REPLACE FUNCTION app_private.get_system_config(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT value FROM app_private.system_config WHERE key = p_key LIMIT 1;
$$;

-- Helper function to set a config value
CREATE OR REPLACE FUNCTION app_private.set_system_config(p_key TEXT, p_value TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO app_private.system_config (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = NOW();
$$;
