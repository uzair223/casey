-- Remove broad visibility of email-less invites (team invite codes)
-- so authenticated users cannot enumerate cross-tenant invite tokens.

DROP POLICY IF EXISTS "Read invites" ON public.invites;

CREATE POLICY "Read invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (
    (
      invites.email IS NOT NULL
      AND lower(invites.email) = lower(auth.email())
    )
    OR (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
    OR public.user_role() = 'app_admin'
  );
