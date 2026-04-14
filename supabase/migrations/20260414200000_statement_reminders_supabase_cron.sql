-- Supabase-native scheduled reminder dispatch job
-- Date: 2026-04-14

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
  site_url := current_setting('app.settings.site_url', true);
  cron_secret := current_setting('app.settings.cron_secret', true);

  IF site_url IS NULL OR site_url = '' THEN
    RAISE EXCEPTION 'Missing required DB setting: app.settings.site_url';
  END IF;

  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'Missing required DB setting: app.settings.cron_secret';
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

REVOKE ALL ON FUNCTION public.run_statement_reminders_job() FROM PUBLIC;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'statement-reminders-hourly'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'statement-reminders-hourly',
    '0 * * * *',
    'SELECT public.run_statement_reminders_job();'
  );
END;
$$;
