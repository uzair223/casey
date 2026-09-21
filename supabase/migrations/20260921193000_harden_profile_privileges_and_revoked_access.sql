-- Lock profile privilege columns against self-service escalation, treat
-- revoked members as unauthenticated for RLS helpers, and rotate predictable
-- never-expiring demo intake tokens.

CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND soft_deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND soft_deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), current_user) IN (
    'service_role',
    'postgres',
    'supabase_admin'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.soft_deleted_at IS DISTINCT FROM OLD.soft_deleted_at THEN
    RAISE EXCEPTION 'privilege columns cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privilege_columns ON public.profiles;
CREATE TRIGGER protect_profile_privilege_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privilege_columns();

DROP POLICY IF EXISTS "Profiles can be created for current user" ON public.profiles;
CREATE POLICY "Profiles can be created for current user"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IS NULL
    AND role = 'paralegal'
    AND soft_deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Profiles can be updated by owner" ON public.profiles;
CREATE POLICY "Profiles can be updated by owner"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role IS NOT DISTINCT FROM (
      SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid()
    )
    AND tenant_id IS NOT DISTINCT FROM (
      SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
    AND soft_deleted_at IS NOT DISTINCT FROM (
      SELECT p.soft_deleted_at FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.revoke_user_sessions(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_sessions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(UUID) TO service_role;

UPDATE public.magic_links
SET
  token = encode(gen_random_bytes(32), 'hex'),
  expires_at = NOW() + INTERVAL '30 days'
WHERE token LIKE 'demo-%';
