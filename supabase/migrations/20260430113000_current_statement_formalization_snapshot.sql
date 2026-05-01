ALTER TABLE public.statements
  ADD COLUMN IF NOT EXISTS formalization_snapshot_id UUID
  REFERENCES public.statement_formalization_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_statements_formalization_snapshot_id
  ON public.statements(formalization_snapshot_id);

DROP POLICY IF EXISTS "Tenant statement managers can create statement formalization snapshots"
  ON public.statement_formalization_snapshots;
CREATE POLICY "Tenant statement managers can create statement formalization snapshots"
  ON public.statement_formalization_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    AND public.user_can_write_tenant_data(tenant_id)
  );

ALTER TABLE public.statements
  DROP COLUMN IF EXISTS sections;
