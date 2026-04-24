CREATE OR REPLACE FUNCTION public.soft_delete_tenant(tenant_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.user_role() <> 'app_admin' THEN
    RAISE EXCEPTION 'Only app admins can revoke tenants';
  END IF;

  UPDATE public.tenants
  SET
    soft_deleted_at = NOW(),
    purge_after = NOW() + INTERVAL '90 days'
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
  IF public.user_role() <> 'app_admin' THEN
    RAISE EXCEPTION 'Only app admins can restore tenants';
  END IF;

  UPDATE public.tenants
  SET
    soft_deleted_at = NULL,
    purge_after = NULL
  WHERE id = tenant_id_param
    AND soft_deleted_at IS NOT NULL
    AND (purge_after IS NULL OR purge_after > NOW());
END;
$$;