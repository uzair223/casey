-- ============================================================================
-- Tenant buckets only (remove case-bucket logic)
-- ============================================================================

-- Tenant bucket helpers
CREATE OR REPLACE FUNCTION public.is_tenant_bucket(bucket_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id::text = bucket_id_param
  );
$$;

CREATE OR REPLACE FUNCTION public.bucket_tenant_is_accessible_to_user(bucket_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id::text = bucket_id_param
      AND (
        t.id = public.user_tenant_id()
        OR public.user_role() = 'app_admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_bucket_has_valid_magic_link(bucket_id_param TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.magic_links ml
    WHERE ml.tenant_id::text = bucket_id_param
      AND ml.expires_at > NOW()
  );
$$;

-- Create a private bucket per tenant on tenant creation
CREATE OR REPLACE FUNCTION public.create_tenant_storage_bucket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES (NEW.id::text, NEW.id::text, false)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_tenant_storage_bucket_trigger ON public.tenants;

CREATE TRIGGER create_tenant_storage_bucket_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_tenant_storage_bucket();

-- Backfill buckets for existing tenants
INSERT INTO storage.buckets (id, name, public)
SELECT t.id::text, t.id::text, false
FROM public.tenants t
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES - TENANT BUCKETS ONLY
-- ============================================================================

CREATE POLICY "Tenant members can upload to tenant buckets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant_bucket(bucket_id)
    AND public.bucket_tenant_is_accessible_to_user(bucket_id)
  );

CREATE POLICY "Tenant members can read from tenant buckets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_bucket(bucket_id)
    AND public.bucket_tenant_is_accessible_to_user(bucket_id)
  );

CREATE POLICY "Anon can upload to tenant buckets via magic link"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    public.is_tenant_bucket(bucket_id)
    AND public.tenant_bucket_has_valid_magic_link(bucket_id)
  );

CREATE POLICY "Anon can read from tenant buckets via magic link"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    public.is_tenant_bucket(bucket_id)
    AND public.tenant_bucket_has_valid_magic_link(bucket_id)
  );

CREATE POLICY "Service role can manage tenant buckets"
  ON storage.objects FOR ALL
  TO service_role
  USING (public.is_tenant_bucket(bucket_id))
  WITH CHECK (public.is_tenant_bucket(bucket_id));

CREATE POLICY "App admins can manage tenant buckets"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    public.is_tenant_bucket(bucket_id)
    AND public.user_role() = 'app_admin'
  )
  WITH CHECK (
    public.is_tenant_bucket(bucket_id)
    AND public.user_role() = 'app_admin'
  );
