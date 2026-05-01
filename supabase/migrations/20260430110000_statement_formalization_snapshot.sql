CREATE TABLE IF NOT EXISTS public.statement_formalization_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  sections JSONB NOT NULL,
  source_message_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  source_message_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statement_formalization_snapshots_statement_created
  ON public.statement_formalization_snapshots(statement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_formalization_snapshots_tenant_created
  ON public.statement_formalization_snapshots(tenant_id, created_at DESC);

ALTER TABLE public.statement_formalization_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view statement formalization snapshots"
  ON public.statement_formalization_snapshots FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can manage statement formalization snapshots"
  ON public.statement_formalization_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.ai_generation_jobs
  DROP CONSTRAINT IF EXISTS ai_generation_jobs_kind_check;
  
ALTER TABLE public.ai_generation_jobs
  ADD COLUMN IF NOT EXISTS formalization_snapshot_id UUID
  REFERENCES public.statement_formalization_snapshots(id) ON DELETE SET NULL;
