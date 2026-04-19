-- Replace tenant storage INSERT-only policy with full management policy for authenticated tenant members

DROP POLICY IF EXISTS "Tenant members can upload to tenant buckets" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can upload to tenant bucket" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can manage tenant buckets" ON storage.objects;
DROP POLICY IF EXISTS "Tenant members can manage tenant bucket" ON storage.objects;

CREATE POLICY "Tenant members can manage tenant buckets"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    public.is_tenant_bucket(bucket_id)
    AND public.bucket_tenant_is_accessible_to_user(bucket_id)
  )
  WITH CHECK (
    public.is_tenant_bucket(bucket_id)
    AND public.bucket_tenant_is_accessible_to_user(bucket_id)
  );
