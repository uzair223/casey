-- Replace DB-level GUC config with table-based config for Supabase-hosted projects
-- Date: 2026-04-14

CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS app_private.scheduler_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE app_private.scheduler_config FROM PUBLIC;

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
  FROM app_private.scheduler_config c
  WHERE c.key = 'site_url'
  LIMIT 1;

  SELECT c.value
  INTO cron_secret
  FROM app_private.scheduler_config c
  WHERE c.key = 'cron_secret'
  LIMIT 1;

  IF site_url IS NULL OR site_url = '' THEN
    RAISE EXCEPTION 'Missing scheduler config: app_private.scheduler_config(key=site_url)';
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'Missing scheduler config: app_private.scheduler_config(key=cron_secret)';
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
