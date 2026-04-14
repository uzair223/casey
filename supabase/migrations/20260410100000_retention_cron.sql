-- Supabase-native scheduled retention purge job
-- Date: 2026-04-10

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.run_retention_purge_job()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  SELECT public.permanently_delete_expired_soft_deleted_tenants()
  INTO deleted_count;

  INSERT INTO public.audit_logs (action, target_type, metadata)
  VALUES (
    'retention.purge.executed',
    'tenant',
    jsonb_build_object('deletedCount', COALESCE(deleted_count, 0))
  );

  RETURN COALESCE(deleted_count, 0);
END;
$$;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'retention-purge-expired-tenants'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'retention-purge-expired-tenants',
    '0 3 * * *',
    'SELECT public.run_retention_purge_job();'
  );
END;
$$;
