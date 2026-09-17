ALTER TABLE public.ai_generation_jobs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_status_claimed
  ON public.ai_generation_jobs(status, claimed_at, created_at);

CREATE OR REPLACE FUNCTION public.run_ai_generation_jobs()
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

  IF site_url IS NULL OR site_url = '' OR cron_secret IS NULL OR cron_secret = '' THEN
    RETURN 0;
  END IF;

  SELECT net.http_post(
    url := format('%s/api/internal/workers/run', rtrim(site_url, '/')),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('limit', 5)
  )
  INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.run_ai_generation_jobs() FROM PUBLIC;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'ai-generation-jobs-sweeper'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'ai-generation-jobs-sweeper',
    '* * * * *',
    'SELECT public.run_ai_generation_jobs();'
  );
END;
$$;
