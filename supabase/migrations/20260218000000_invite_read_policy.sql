-- Migration: Add granular read policy for invites
-- Date: 2026-02-18
-- Description: Allow users to read invites sent to their email, their tenant's invites, or all invites if app_admin

-- Drop the existing all-encompassing policy
DROP POLICY IF EXISTS "Manage invites" ON invites;

-- Create separate SELECT policy with user email access
CREATE POLICY "Read invites"
  ON invites FOR SELECT
  TO authenticated
  USING (
    -- User can read invite if it's sent to their email
    (invites.email IS NOT NULL AND invites.email = auth.email())
    OR
    -- Public invite with no email attached
    (invites.email IS NULL)
    OR
    -- User can read invites for their tenant if they're tenant_admin or solicitor
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
    OR
    -- App admins can read all invites
    public.user_role() = 'app_admin'
  );

-- Create INSERT policy
CREATE POLICY "Create invites"
  ON invites FOR INSERT
  TO authenticated
  WITH CHECK (
    -- App admins can create any invite
    public.user_role() = 'app_admin'
    OR
    -- Tenant admins and solicitors can create invites for their tenant (not app_admin role)
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND invites.role != 'app_admin'
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );

-- Create UPDATE policy
CREATE POLICY "Update invites"
  ON invites FOR UPDATE
  TO authenticated
  USING (
    -- App admins can update all invites
    public.user_role() = 'app_admin'
    OR
    -- Tenant admins and solicitors can update invites for their tenant
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  )
  WITH CHECK (
    -- App admins can update any invite
    public.user_role() = 'app_admin'
    OR
    -- Tenant admins can update invites for their tenant (not app_admin role)
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND invites.role != 'app_admin'
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );

-- Create DELETE policy
CREATE POLICY "Delete invites"
  ON invites FOR DELETE
  TO authenticated
  USING (
    -- App admins can delete all invites
    public.user_role() = 'app_admin'
    OR
    -- Tenant admins and solicitors can delete invites for their tenant
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );
