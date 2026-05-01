CREATE TABLE IF NOT EXISTS public.ai_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  requested_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot_id UUID REFERENCES public.case_analysis_snapshots(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT ai_generation_jobs_kind_check
    CHECK (kind IN ('case_analysis')),
  CONSTRAINT ai_generation_jobs_status_check
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_target_created
  ON public.ai_generation_jobs(kind, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_tenant_status_created
  ON public.ai_generation_jobs(tenant_id, status, created_at DESC);

ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read ai generation jobs"
  ON public.ai_generation_jobs;
CREATE POLICY "Tenant users can read ai generation jobs"
  ON public.ai_generation_jobs FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

DROP POLICY IF EXISTS "Service role can manage ai generation jobs"
  ON public.ai_generation_jobs;
CREATE POLICY "Service role can manage ai generation jobs"
  ON public.ai_generation_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
