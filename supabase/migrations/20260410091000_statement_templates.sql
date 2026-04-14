-- Statement template persistence and immutable snapshot bindings
-- Date: 2026-04-10

CREATE TABLE IF NOT EXISTS public.statement_config_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  template_scope TEXT NOT NULL CHECK (template_scope IN ('global', 'tenant')),
  source_template_id UUID REFERENCES public.statement_config_templates(id) ON DELETE SET NULL,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB,
  docx_template_document JSONB,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT statement_config_templates_scope_tenant_consistency_chk CHECK (
    (template_scope = 'global' AND tenant_id IS NULL)
    OR (template_scope = 'tenant' AND tenant_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.statement_config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.statement_config_templates(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  template_scope TEXT NOT NULL CHECK (template_scope IN ('global', 'tenant')),
  config_name TEXT NOT NULL,
  config_json JSONB NOT NULL,
  template_document JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statement_config_templates_tenant_id
  ON public.statement_config_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statement_config_templates_scope
  ON public.statement_config_templates(template_scope);
CREATE INDEX IF NOT EXISTS idx_statement_config_templates_status
  ON public.statement_config_templates(status);
CREATE INDEX IF NOT EXISTS idx_statement_config_templates_source_template_id
  ON public.statement_config_templates(source_template_id);

CREATE INDEX IF NOT EXISTS idx_statement_config_snapshots_tenant_id
  ON public.statement_config_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statement_config_snapshots_template_id
  ON public.statement_config_snapshots(template_id);

CREATE INDEX IF NOT EXISTS idx_statements_template_id
  ON public.statements(template_id);
CREATE INDEX IF NOT EXISTS idx_statements_config_snapshot_id
  ON public.statements(config_snapshot_id);

ALTER TABLE public.statement_config_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_config_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read statement templates"
  ON public.statement_config_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR tenant_id IS NULL
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Authorized users can create statement templates"
  ON public.statement_config_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
    )
  );

CREATE POLICY "Authorized users can update statement templates"
  ON public.statement_config_templates FOR UPDATE
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.user_role() = 'app_admin')
    OR (
      tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
    )
  )
  WITH CHECK (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
    )
  );

CREATE POLICY "Authorized users can delete statement templates"
  ON public.statement_config_templates FOR DELETE
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.user_role() = 'app_admin')
    OR (
      tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
    )
  );

CREATE POLICY "Service role can manage statement templates"
  ON public.statement_config_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read statement config snapshots"
  ON public.statement_config_snapshots FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Authorized users can create statement config snapshots"
  ON public.statement_config_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Service role can manage statement config snapshots"
  ON public.statement_config_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS statement_config_templates_updated_at ON public.statement_config_templates;
CREATE TRIGGER statement_config_templates_updated_at
  BEFORE UPDATE ON public.statement_config_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
