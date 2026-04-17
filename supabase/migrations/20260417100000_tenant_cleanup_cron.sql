-- Scheduled tenant cleanup job (purge expired soft-deleted tenants)
-- Date: 2026-04-17

CREATE OR REPLACE FUNCTION public.run_tenant_cleanup_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM permanently_delete_expired_soft_deleted_tenants();
END;
$$;

REVOKE ALL ON FUNCTION public.run_tenant_cleanup_job() FROM PUBLIC;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'tenant-cleanup-daily'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'tenant-cleanup-daily',
    '0 2 * * *',
    'SELECT public.run_tenant_cleanup_job();'
  );
END;
$$;
