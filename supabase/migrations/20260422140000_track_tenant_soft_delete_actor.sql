ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS soft_deleted_by_role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_soft_deleted_by_role_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_soft_deleted_by_role_check
      CHECK (soft_deleted_by_role IN ('tenant_admin', 'app_admin') OR soft_deleted_by_role IS NULL);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.soft_delete_tenant(tenant_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tenants
  SET
    soft_deleted_at = NOW(),
    purge_after = NOW() + INTERVAL '90 days',
    soft_deleted_by_role = public.user_role()
  WHERE id = tenant_id_param
    AND soft_deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_tenant(tenant_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.user_role() = 'tenant_admin' THEN
    UPDATE public.tenants
    SET
      soft_deleted_at = NULL,
      purge_after = NULL,
      soft_deleted_by_role = NULL
    WHERE id = tenant_id_param
      AND soft_deleted_at IS NOT NULL
      AND soft_deleted_by_role IS DISTINCT FROM 'app_admin'
      AND (purge_after IS NULL OR purge_after > NOW());
    RETURN;
  END IF;

  IF public.user_role() = 'app_admin' THEN
    UPDATE public.tenants
    SET
      soft_deleted_at = NULL,
      purge_after = NULL,
      soft_deleted_by_role = NULL
    WHERE id = tenant_id_param
      AND soft_deleted_at IS NOT NULL
      AND (purge_after IS NULL OR purge_after > NOW());
    RETURN;
  END IF;

  RAISE EXCEPTION 'Only tenant admins or app admins can restore tenants';
END;
$$;