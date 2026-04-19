-- Restrict template visibility so app admins only see globally scoped templates
-- and tenant users only see their own templates plus global templates.
-- Tenant admins and solicitors can manage their own templates; app admins can only manage global templates.

DROP POLICY IF EXISTS "Authenticated users can read case templates" ON public.case_templates;
DROP POLICY IF EXISTS "Authenticated users can read statement templates" ON public.statement_config_templates;
DROP POLICY IF EXISTS "Authenticated users can read case-template statement mappings" ON public.case_template_statement_templates;
DROP POLICY IF EXISTS "Authorized users can manage case-template statement mappings" ON public.case_template_statement_templates;
DROP POLICY IF EXISTS "Authorized users can create case templates" ON public.case_templates;
DROP POLICY IF EXISTS "Authorized users can update case templates" ON public.case_templates;
DROP POLICY IF EXISTS "Authorized users can delete case templates" ON public.case_templates;
DROP POLICY IF EXISTS "Authorized users can create statement templates" ON public.statement_config_templates;
DROP POLICY IF EXISTS "Authorized users can update statement templates" ON public.statement_config_templates;
DROP POLICY IF EXISTS "Authorized users can delete statement templates" ON public.statement_config_templates;
DROP POLICY IF EXISTS "Authorized users can manage case templates" ON public.case_templates;
DROP POLICY IF EXISTS "Authorized users can manage statement templates" ON public.statement_config_templates;

-- Recreate policies with updated visibility rules

CREATE POLICY "Authenticated users can read case templates"
  ON public.case_templates FOR SELECT
  TO authenticated
  USING (
    (
      public.user_role() = 'app_admin'
      AND tenant_id IS NULL
    )
    OR (
      public.user_role() <> 'app_admin'
      AND (
        tenant_id = public.user_tenant_id()
        OR tenant_id IS NULL
      )
    )
  );

CREATE POLICY "Authenticated users can read statement templates"
  ON public.statement_config_templates FOR SELECT
  TO authenticated
  USING (
    (
      public.user_role() = 'app_admin'
      AND tenant_id IS NULL
    )
    OR (
      public.user_role() <> 'app_admin'
      AND (
        tenant_id = public.user_tenant_id()
        OR tenant_id IS NULL
      )
    )
  );

CREATE POLICY "Authorized users can manage case templates"
  ON public.case_templates FOR ALL
  TO authenticated
  USING (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      public.user_role() IN ('tenant_admin', 'solicitor')
      AND tenant_id = public.user_tenant_id()
    )
  )
  WITH CHECK (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      public.user_role() IN ('tenant_admin', 'solicitor')
      AND tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Authorized users can manage statement templates"
  ON public.statement_config_templates FOR ALL
  TO authenticated
  USING (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      public.user_role() IN ('tenant_admin', 'solicitor')
      AND tenant_id = public.user_tenant_id()
    )
  )
  WITH CHECK (
    (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    OR (
      public.user_role() IN ('tenant_admin', 'solicitor')
      AND tenant_id = public.user_tenant_id()
    )
  );

CREATE POLICY "Authenticated users can read case-template statement mappings"
  ON public.case_template_statement_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_templates ct
      WHERE ct.id = case_template_statement_templates.case_template_id
        AND (
          (
            public.user_role() = 'app_admin'
            AND ct.tenant_id IS NULL
          )
          OR (
            public.user_role() <> 'app_admin'
            AND (
              ct.tenant_id = public.user_tenant_id()
              OR ct.tenant_id IS NULL
            )
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.statement_config_templates st
      WHERE st.id = case_template_statement_templates.statement_template_id
        AND (
          (
            public.user_role() = 'app_admin'
            AND st.tenant_id IS NULL
          )
          OR (
            public.user_role() <> 'app_admin'
            AND (
              st.tenant_id = public.user_tenant_id()
              OR st.tenant_id IS NULL
            )
          )
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
          (
            public.user_role() = 'app_admin'
            AND ct.tenant_id IS NULL
          )
          OR (
            public.user_role() IN ('tenant_admin', 'solicitor')
            AND (
              ct.tenant_id = public.user_tenant_id()
              OR ct.tenant_id IS NULL
            )
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.statement_config_templates st
      WHERE st.id = case_template_statement_templates.statement_template_id
        AND (
          (
            public.user_role() = 'app_admin'
            AND st.tenant_id IS NULL
          )
          OR (
            public.user_role() IN ('tenant_admin', 'solicitor')
            AND (
              st.tenant_id = public.user_tenant_id()
              OR st.tenant_id IS NULL
            )
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
          (
            public.user_role() = 'app_admin'
            AND ct.tenant_id IS NULL
          )
          OR (
            public.user_role() IN ('tenant_admin', 'solicitor')
            AND (
              ct.tenant_id = public.user_tenant_id()
              OR ct.tenant_id IS NULL
            )
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.statement_config_templates st
      WHERE st.id = case_template_statement_templates.statement_template_id
        AND (
          (
            public.user_role() = 'app_admin'
            AND st.tenant_id IS NULL
          )
          OR (
            public.user_role() IN ('tenant_admin', 'solicitor')
            AND (
              st.tenant_id = public.user_tenant_id()
              OR st.tenant_id IS NULL
            )
          )
        )
    )
  );
