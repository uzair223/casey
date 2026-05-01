CREATE TABLE IF NOT EXISTS public.case_analysis_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  analysis JSONB NOT NULL,
  source_statement_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  source_statement_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_analysis_snapshots_case_created_at
  ON public.case_analysis_snapshots(case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_analysis_snapshots_tenant_created_at
  ON public.case_analysis_snapshots(tenant_id, created_at DESC);

ALTER TABLE public.case_analysis_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view case analysis snapshots"
  ON public.case_analysis_snapshots FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage case analysis snapshots"
  ON public.case_analysis_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
