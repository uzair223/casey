-- Case template system with tenant preferences and statement-template mappings
-- Date: 2026-04-09

CREATE TABLE IF NOT EXISTS public.case_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  template_scope TEXT NOT NULL CHECK (template_scope IN ('global', 'tenant')),
  source_template_id UUID REFERENCES public.case_templates(id) ON DELETE SET NULL,
  draft_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_config JSONB,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT case_templates_scope_tenant_consistency_chk CHECK (
    (template_scope = 'global' AND tenant_id IS NULL)
    OR (template_scope = 'tenant' AND tenant_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.case_template_statement_templates (
  case_template_id UUID NOT NULL REFERENCES public.case_templates(id) ON DELETE CASCADE,
  statement_template_id UUID NOT NULL REFERENCES public.statement_config_templates(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_template_id, statement_template_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_template_statement_default
  ON public.case_template_statement_templates(case_template_id)
  WHERE is_default = true;

CREATE TABLE IF NOT EXISTS public.case_template_tenant_preferences (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_case_template_id UUID REFERENCES public.case_templates(id) ON DELETE SET NULL,
  favourite_case_template_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cases_case_template_id_fkey'
  ) THEN
    ALTER TABLE public.cases
      ADD CONSTRAINT cases_case_template_id_fkey
      FOREIGN KEY (case_template_id)
      REFERENCES public.case_templates(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'statements_template_id_fkey'
  ) THEN
    ALTER TABLE public.statements
      ADD CONSTRAINT statements_template_id_fkey
      FOREIGN KEY (template_id)
      REFERENCES public.statement_config_templates(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'statements_config_snapshot_id_fkey'
  ) THEN
    ALTER TABLE public.statements
      ADD CONSTRAINT statements_config_snapshot_id_fkey
      FOREIGN KEY (config_snapshot_id)
      REFERENCES public.statement_config_snapshots(id)
      ON DELETE SET NULL;
  END IF;

END $$;

CREATE INDEX IF NOT EXISTS idx_case_templates_tenant_id
  ON public.case_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_templates_scope
  ON public.case_templates(template_scope);
CREATE INDEX IF NOT EXISTS idx_case_templates_status
  ON public.case_templates(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_template_id
  ON public.cases(case_template_id);
CREATE INDEX IF NOT EXISTS idx_case_template_statement_statement_id
  ON public.case_template_statement_templates(statement_template_id);

ALTER TABLE public.case_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_template_statement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_template_tenant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read case templates"
  ON public.case_templates FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR tenant_id IS NULL
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Authorized users can create case templates"
  ON public.case_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
    )
  );

CREATE POLICY "Authorized users can update case templates"
  ON public.case_templates FOR UPDATE
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

CREATE POLICY "Authorized users can delete case templates"
  ON public.case_templates FOR DELETE
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.user_role() = 'app_admin')
    OR (
      tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
    )
  );

CREATE POLICY "Service role can manage case templates"
  ON public.case_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read case-template statement mappings"
  ON public.case_template_statement_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_templates ct
      WHERE ct.id = case_template_statement_templates.case_template_id
        AND (
          ct.tenant_id = public.user_tenant_id()
          OR ct.tenant_id IS NULL
          OR public.user_role() = 'app_admin'
        )
    )
  );

CREATE POLICY "Authorized users can manage case-template statement mappings"
  ON public.case_template_statement_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_templates ct
      WHERE ct.id = case_template_statement_templates.case_template_id
        AND (
          (ct.tenant_id IS NULL AND public.user_role() = 'app_admin')
          OR (
            ct.tenant_id = public.user_tenant_id()
            AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.case_templates ct
      WHERE ct.id = case_template_statement_templates.case_template_id
        AND (
          (ct.tenant_id IS NULL AND public.user_role() = 'app_admin')
          OR (
            ct.tenant_id = public.user_tenant_id()
            AND public.user_role() IN ('tenant_admin', 'solicitor', 'app_admin')
          )
        )
    )
  );

CREATE POLICY "Service role can manage case-template statement mappings"
  ON public.case_template_statement_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authorized users can read case template preferences"
  ON public.case_template_tenant_preferences FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Tenant admins can manage case template preferences"
  ON public.case_template_tenant_preferences FOR ALL
  TO authenticated
  USING (
    (
      tenant_id = public.user_tenant_id()
      AND public.user_role() = 'tenant_admin'
    )
    OR public.user_role() = 'app_admin'
  )
  WITH CHECK (
    (
      tenant_id = public.user_tenant_id()
      AND public.user_role() = 'tenant_admin'
    )
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Service role can manage case template preferences"
  ON public.case_template_tenant_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS case_templates_updated_at ON public.case_templates;
CREATE TRIGGER case_templates_updated_at
  BEFORE UPDATE ON public.case_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS case_template_tenant_preferences_updated_at ON public.case_template_tenant_preferences;
CREATE TRIGGER case_template_tenant_preferences_updated_at
  BEFORE UPDATE ON public.case_template_tenant_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
