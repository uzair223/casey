-- Move tenant write permissions into RLS so browser clients cannot bypass UI
-- role checks by calling Supabase directly.

CREATE OR REPLACE FUNCTION public.user_can_write_tenant_data(tenant_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.is_tenant_active(tenant_id_param)
    AND (
      public.user_role() = 'app_admin'
      OR (
        tenant_id_param = public.user_tenant_id()
        AND public.user_role() IN ('tenant_admin', 'solicitor')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_tenant_bucket(bucket_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id::text = bucket_id_param
      AND public.user_can_write_tenant_data(t.id)
  );
$$;

DROP POLICY IF EXISTS "Authenticated users can manage cases" ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can update cases" ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can delete cases" ON public.cases;

CREATE POLICY "Tenant case managers can create cases"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    AND public.user_can_write_tenant_data(tenant_id)
  );

CREATE POLICY "Tenant case managers can update cases"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (public.user_can_write_tenant_data(tenant_id))
  WITH CHECK (
    (tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    AND public.user_can_write_tenant_data(tenant_id)
  );

CREATE POLICY "Tenant case managers can delete cases"
  ON public.cases FOR DELETE
  TO authenticated
  USING (public.user_can_write_tenant_data(tenant_id));

DROP POLICY IF EXISTS "Authenticated users can manage witness statements"
  ON public.statements;
DROP POLICY IF EXISTS "Authenticated users can update witness statements"
  ON public.statements;
DROP POLICY IF EXISTS "Authenticated users can delete witness statements"
  ON public.statements;

CREATE POLICY "Tenant statement managers can create witness statements"
  ON public.statements FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    AND public.user_can_write_tenant_data(tenant_id)
  );

CREATE POLICY "Tenant statement managers can update witness statements"
  ON public.statements FOR UPDATE
  TO authenticated
  USING (public.user_can_write_tenant_data(tenant_id))
  WITH CHECK (
    (tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    AND public.user_can_write_tenant_data(tenant_id)
  );

CREATE POLICY "Tenant statement managers can delete witness statements"
  ON public.statements FOR DELETE
  TO authenticated
  USING (public.user_can_write_tenant_data(tenant_id));

DROP POLICY IF EXISTS "Authorized users can create magic links"
  ON public.magic_links;

CREATE POLICY "Tenant statement managers can create magic links"
  ON public.magic_links FOR INSERT
  TO authenticated
  WITH CHECK (
    (tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    AND public.user_can_write_tenant_data(tenant_id)
  );

DROP POLICY IF EXISTS "Tenant members can manage tenant buckets"
  ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can manage tenant bucket"
  ON storage.objects;

CREATE POLICY "Tenant file managers can manage tenant buckets"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    public.is_tenant_bucket(bucket_id)
    AND public.bucket_tenant_is_accessible_to_user(bucket_id)
    AND public.user_can_write_tenant_bucket(bucket_id)
  )
  WITH CHECK (
    public.is_tenant_bucket(bucket_id)
    AND public.bucket_tenant_is_accessible_to_user(bucket_id)
    AND public.user_can_write_tenant_bucket(bucket_id)
  );
