-- Consolidated security, lifecycle, and RLS policies for fresh database resets
-- Date: 2026-04-10

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON public.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
  ON public.audit_logs(action, created_at DESC);

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  reviewed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_tenant_status
  ON public.account_deletion_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_requested_user
  ON public.account_deletion_requests(requested_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_deletion_requests_pending_unique
  ON public.account_deletion_requests(requested_user_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.is_tenant_active(tenant_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = tenant_id_param
      AND t.soft_deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_is_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_tenant_active(public.user_tenant_id());
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_tenant(tenant_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
  UPDATE public.tenants
  SET
    soft_deleted_at = NULL,
    purge_after = NULL
  WHERE id = tenant_id_param;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanently_delete_expired_soft_deleted_tenants()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM public.tenants
  WHERE soft_deleted_at IS NOT NULL
    AND COALESCE(purge_after, soft_deleted_at + INTERVAL '90 days') <= NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

DROP TRIGGER IF EXISTS account_deletion_requests_updated_at ON public.account_deletion_requests;
CREATE TRIGGER account_deletion_requests_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tenants_soft_deleted_at
  ON public.tenants(soft_deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenants_purge_after
  ON public.tenants(purge_after);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can read tenants"
  ON public.tenants FOR SELECT
  USING (
    (
      auth.role() = 'authenticated'
      AND (
        public.user_role() = 'app_admin'
        OR (
          id = public.user_tenant_id()
          AND soft_deleted_at IS NULL
        )
      )
    )
    OR (
      auth.role() = 'anon'
      AND soft_deleted_at IS NULL
      AND public.tenant_has_valid_magic_link(id)
    )
  );

CREATE POLICY "Profiles are visible to authorized users"
  ON public.profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND tenant_id = public.user_tenant_id())
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Profiles can be created for current user"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Profiles can be updated by owner"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can read magic links for their tenant"
  ON public.magic_links FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Unauthenticated users can read valid magic links"
  ON public.magic_links FOR SELECT
  TO anon
  USING (expires_at > NOW());

CREATE POLICY "Authorized users can create magic links"
  ON public.magic_links FOR INSERT
  WITH CHECK (
    (
      tenant_id = public.user_tenant_id()
      AND public.current_tenant_is_active()
    )
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Authenticated users can view cases"
  ON public.cases FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can manage cases"
  ON public.cases FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can update cases"
  ON public.cases FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete cases"
  ON public.cases FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can read cases"
  ON public.cases FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can view witness statements"
  ON public.statements FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can manage witness statements"
  ON public.statements FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can update witness statements"
  ON public.statements FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete witness statements"
  ON public.statements FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can read witness statements"
  ON public.statements FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Authenticated users can read conversation messages"
  ON public.conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.statements ws
      WHERE ws.id = conversation_messages.statement_id
        AND ws.tenant_id = public.user_tenant_id()
        AND public.is_tenant_active(ws.tenant_id)
    )
  );

CREATE POLICY "Read invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (
    (invites.email IS NOT NULL AND invites.email = auth.email())
    OR (invites.email IS NULL)
    OR (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Create invites"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role() = 'app_admin'
    OR (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND invites.role != 'app_admin'
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );

CREATE POLICY "Update invites"
  ON public.invites FOR UPDATE
  TO authenticated
  USING (
    public.user_role() = 'app_admin'
    OR (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  )
  WITH CHECK (
    public.user_role() = 'app_admin'
    OR (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND invites.role != 'app_admin'
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );

CREATE POLICY "Delete invites"
  ON public.invites FOR DELETE
  TO authenticated
  USING (
    public.user_role() = 'app_admin'
    OR (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );

CREATE POLICY "App admins can read waitlist signups"
  ON public.waitlist_signups FOR SELECT
  TO authenticated
  USING (public.user_role() = 'app_admin');

CREATE POLICY "App admins can update waitlist signups"
  ON public.waitlist_signups FOR UPDATE
  TO authenticated
  USING (public.user_role() = 'app_admin')
  WITH CHECK (public.user_role() = 'app_admin');

CREATE POLICY "Service role can insert waitlist signups"
  ON public.waitlist_signups FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "App admins can read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.user_role() = 'app_admin');

CREATE POLICY "Tenant admins can read tenant audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.user_role() = 'tenant_admin'
    AND tenant_id = public.user_tenant_id()
  );

CREATE POLICY "Users can read own audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

CREATE POLICY "Service role can write audit logs"
  ON public.audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can create own deletion requests"
  ON public.account_deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_user_id = auth.uid()
    AND requested_by_user_id = auth.uid()
    AND (
      tenant_id = public.user_tenant_id()
      OR (public.user_role() = 'app_admin' AND tenant_id IS NULL)
    )
  );

CREATE POLICY "Users can read own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (requested_user_id = auth.uid());

CREATE POLICY "Tenant admins can read tenant deletion requests"
  ON public.account_deletion_requests FOR SELECT
  TO authenticated
  USING (
    public.user_role() = 'tenant_admin'
    AND tenant_id = public.user_tenant_id()
  );

CREATE POLICY "Tenant admins can update tenant deletion requests"
  ON public.account_deletion_requests FOR UPDATE
  TO authenticated
  USING (
    public.user_role() = 'tenant_admin'
    AND tenant_id = public.user_tenant_id()
  )
  WITH CHECK (
    public.user_role() = 'tenant_admin'
    AND tenant_id = public.user_tenant_id()
  );

CREATE POLICY "App admins can manage deletion requests"
  ON public.account_deletion_requests FOR ALL
  TO authenticated
  USING (public.user_role() = 'app_admin')
  WITH CHECK (public.user_role() = 'app_admin');

CREATE POLICY "Service role can manage deletion requests"
  ON public.account_deletion_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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

CREATE POLICY "Authenticated users can read global template bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'global-templates');

CREATE POLICY "App admins can manage global template bucket"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'global-templates'
    AND public.user_role() = 'app_admin'
  )
  WITH CHECK (
    bucket_id = 'global-templates'
    AND public.user_role() = 'app_admin'
  );

CREATE POLICY "Service role can manage global template bucket"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'global-templates')
  WITH CHECK (bucket_id = 'global-templates');
