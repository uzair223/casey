-- Add case config snapshots to prevent schema drift
-- Date: 2026-04-14

-- Create case_config_snapshots table
CREATE TABLE IF NOT EXISTS public.case_config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.case_templates(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  template_scope TEXT NOT NULL CHECK (template_scope IN ('global', 'tenant')),
  config_name TEXT NOT NULL,
  config_json JSONB NOT NULL,
  template_document JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_case_config_snapshots_tenant_id
  ON public.case_config_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_config_snapshots_template_id
  ON public.case_config_snapshots(template_id);

-- Enable RLS
ALTER TABLE public.case_config_snapshots ENABLE ROW LEVEL SECURITY;

-- Add config_snapshot_id to cases table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'cases'
      AND column_name = 'config_snapshot_id'
  ) THEN
    ALTER TABLE public.cases
      ADD COLUMN config_snapshot_id UUID REFERENCES public.case_config_snapshots(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for case -> snapshot lookups
CREATE INDEX IF NOT EXISTS idx_cases_config_snapshot_id
  ON public.cases(config_snapshot_id);

-- RLS policies for case_config_snapshots
CREATE POLICY "Authenticated users can read case snapshots in their tenant"
  ON public.case_config_snapshots FOR SELECT
  TO authenticated
  USING (tenant_id = public.user_tenant_id());

CREATE POLICY "Authenticated users can insert case snapshots in their tenant"
  ON public.case_config_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.user_tenant_id());

CREATE POLICY "Service role can manage case snapshots"
  ON public.case_config_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
