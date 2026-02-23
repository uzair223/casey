-- ============================================================================
-- Database Schema - Consolidated Migration
-- Complete schema with all tables, indexes, functions, triggers, and RLS policies
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Tenants (law firms/organizations)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles with role-based access
-- Roles: app_admin (global), tenant_admin, solicitor, paralegal
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants ON DELETE CASCADE, -- NULL for app_admins
  role TEXT NOT NULL DEFAULT 'paralegal' CHECK (role IN ('app_admin', 'tenant_admin', 'solicitor', 'paralegal')),
  display_name TEXT, -- User's display name, collected during onboarding
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Witness statements
CREATE TABLE IF NOT EXISTS public.statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants ON DELETE CASCADE,
  title TEXT NOT NULL,
  reference TEXT NOT NULL,
  claim_number TEXT,
  assigned_to UUID REFERENCES auth.users ON DELETE SET NULL,
  witness_name TEXT NOT NULL,
  witness_address TEXT,
  witness_occupation TEXT,
  witness_email TEXT NOT NULL,
  incident_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'locked')),
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  supporting_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_document JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Magic links for witness access
CREATE TABLE IF NOT EXISTS public.magic_links (
  token TEXT PRIMARY KEY,
  statement_id UUID NOT NULL REFERENCES statements ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  first_accessed_at TIMESTAMPTZ,
  first_access_ip INET,
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation messages for AI-assisted statement collection
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES statements ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  progress JSONB,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unified invites table
-- Logic:
--   - email = NULL: Anyone with token can accept (anonymous invite link)
--   - email = set: Only that email can accept
--   - tenant_id = NULL + role = tenant_admin: Creates new tenant on acceptance
--   - tenant_id = set: Joins existing tenant with specified role
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,  -- NULL = anyone can use the token
  token TEXT NOT NULL UNIQUE,
  tenant_id UUID REFERENCES tenants ON DELETE CASCADE,  -- NULL = creates new tenant (if role = tenant_admin)
  role TEXT NOT NULL CHECK (role IN ('paralegal', 'solicitor', 'tenant_admin', 'app_admin')),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_statements_tenant_id ON statements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statements_assigned_to ON statements(assigned_to);
CREATE INDEX IF NOT EXISTS idx_magic_links_statement_id ON magic_links(statement_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_statement_id ON conversation_messages(statement_id);
CREATE INDEX IF NOT EXISTS idx_invites_tenant_id ON invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_role ON invites(role);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Helper function to get current user's tenant_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Helper function to get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to statements table
CREATE TRIGGER statements_updated_at
  BEFORE UPDATE ON statements
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SECURITY DEFINER FUNCTIONS FOR MAGIC LINKS
-- ============================================================================

-- Check if a magic link is valid (used within API routes, not from client)
CREATE OR REPLACE FUNCTION public.validate_magic_link(token_param TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  statement_id UUID,
  tenant_id UUID,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (ml.used_at IS NULL AND ml.expires_at > NOW())::BOOLEAN,
    ml.statement_id,
    ml.tenant_id,
    ml.expires_at
  FROM magic_links ml
  WHERE ml.token = token_param
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update magic link usage (called after witness completes action)
CREATE OR REPLACE FUNCTION public.mark_magic_link_used(token_param TEXT, ip_address INET DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  link_exists BOOLEAN;
BEGIN
  -- Check if link exists and hasn't been used
  SELECT EXISTS(
    SELECT 1 FROM magic_links 
    WHERE token = token_param AND used_at IS NULL
  ) INTO link_exists;
  
  IF NOT link_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Update link atomically
  UPDATE magic_links
  SET 
    used_at = NOW(),
    last_accessed_at = NOW(),
    first_access_ip = COALESCE(first_access_ip, ip_address)
  WHERE token = token_param AND used_at IS NULL;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a statement has at least one valid (unused, non-expired) magic link
-- Used for RLS to allow anon access to statements via magic links
CREATE OR REPLACE FUNCTION public.statement_has_valid_magic_link(statement_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM magic_links ml
    WHERE ml.statement_id = statement_id_param
    AND ml.used_at IS NULL
    AND ml.expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if a tenant has at least one valid (unused, non-expired) magic link
-- Used for RLS to allow anon access to tenant info via magic links
CREATE OR REPLACE FUNCTION public.tenant_has_valid_magic_link(tenant_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM magic_links ml
    WHERE ml.tenant_id = tenant_id_param
    AND ml.used_at IS NULL
    AND ml.expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TENANTS POLICIES
-- ============================================================================

CREATE POLICY "Authorized users can read tenants"
  ON tenants FOR SELECT
  USING (
    -- Tenant members can read their tenant
    id = public.user_tenant_id()
    -- App admins can read all tenants
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "App admins can create tenants"
  ON tenants FOR INSERT
  WITH CHECK (public.user_role() = 'app_admin');

-- Anon users can read tenants via valid magic links (for statement intake)
CREATE POLICY "Anon users can read tenants via magic link"
  ON tenants FOR SELECT
  TO anon
  USING (
    public.tenant_has_valid_magic_link(id)
  );

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

CREATE POLICY "Profiles are visible to authorized users"
  ON profiles FOR SELECT
  USING (
    -- Users can always see their own profile
    user_id = auth.uid()
    -- Tenant members can see other tenant members
    OR (tenant_id IS NOT NULL AND tenant_id = public.user_tenant_id())
    -- App admins can see all profiles
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Profiles can be created for current user"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Profiles can be updated by owner"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- Authenticated users can read magic links for their tenant
CREATE POLICY "Authenticated users can read magic links for their tenant"
  ON public.magic_links FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin'
  );

-- Unauthenticated users can read valid magic links
CREATE POLICY "Unauthenticated users can read valid magic links"
  ON public.magic_links FOR SELECT
  TO anon
  USING (
    used_at IS NULL
    AND expires_at > NOW()
  );

-- Only tenant can create magic links
CREATE POLICY "Authorized users can create magic links"
  ON public.magic_links FOR INSERT
  WITH CHECK (
    tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin'
  );

-- Only tenant_admin/app_admin can update their tenant's magic links
CREATE POLICY "Authorized users can update magic links"
  ON public.magic_links FOR UPDATE
  USING (
    tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin'
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin'
  );

-- Only tenant_admin/app_admin can delete magic links
CREATE POLICY "Authorized users can delete magic links"
  ON public.magic_links FOR DELETE
  USING (
    tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin'
  );

-- ============================================================================
-- STATEMENTS POLICIES
-- ============================================================================

-- Authenticated users can view statements from their tenant
CREATE POLICY "Authenticated users can view statements"
  ON statements FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  );

-- Authenticated users can manage statements
CREATE POLICY "Authenticated users can manage statements"
  ON statements FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
  );

CREATE POLICY "Authenticated users can update statements"
  ON statements FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
  );

CREATE POLICY "Authenticated users can delete statements"
  ON statements FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    OR public.user_role() = 'app_admin'
  );

-- Service role can read statements (needed for magic link validation)
CREATE POLICY "Service role can read statements"
  ON statements FOR SELECT
  TO service_role
  USING (true);

-- Service role can update statements (for witness submissions)
CREATE POLICY "Service role can update statements"
  ON statements FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon users can read statements with valid magic links
CREATE POLICY "Anon users can read statements via magic link"
  ON statements FOR SELECT
  TO anon
  USING (
    public.statement_has_valid_magic_link(statements.id)
  );

-- Anon users can update statements with valid magic links (for submissions)
CREATE POLICY "Anon users can update statements via magic link"
  ON statements FOR UPDATE
  TO anon
  USING (
    public.statement_has_valid_magic_link(statements.id)
  )
  WITH CHECK (
    public.statement_has_valid_magic_link(statements.id)
  );

-- ============================================================================
-- INVITES POLICIES
-- ============================================================================

CREATE POLICY "Manage invites"
  ON invites FOR ALL
  USING (
    -- App admins can manage all invites
    public.user_role() = 'app_admin'
    OR
    -- Tenant admins and solicitors can manage invites for their tenant only
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  )
  WITH CHECK (
    -- App admins can create any invite
    public.user_role() = 'app_admin'
    OR
    -- Tenant admins can create invites for their tenant (not app_admin role)
    (
      invites.tenant_id IS NOT NULL
      AND invites.tenant_id = public.user_tenant_id()
      AND invites.role != 'app_admin'
      AND public.user_role() IN ('tenant_admin', 'solicitor')
    )
  );

-- ============================================================================
-- CONVERSATION MESSAGES POLICIES
-- ============================================================================

-- Authenticated users can read messages for their tenant's statements
CREATE POLICY "Authenticated users can read conversation messages"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM statements s
      WHERE s.id = conversation_messages.statement_id
      AND (s.tenant_id = public.user_tenant_id() OR public.user_role() = 'app_admin')
    )
  );

-- Authenticated users can create messages for their tenant's statements
CREATE POLICY "Authenticated users can create conversation messages"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM statements s
      WHERE s.id = conversation_messages.statement_id
      AND s.tenant_id = public.user_tenant_id()
    )
  );

-- Service role can manage all messages (for AI chat API)
CREATE POLICY "Service role can manage conversation messages"
  ON conversation_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon users can read messages for statements with valid magic links
CREATE POLICY "Anon users can read messages via magic link"
  ON conversation_messages FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM magic_links ml
      WHERE ml.statement_id = conversation_messages.statement_id
      AND ml.used_at IS NULL
      AND ml.expires_at > NOW()
    )
  );

-- Anon users can create messages for statements with valid magic links
CREATE POLICY "Anon users can create messages via magic link"
  ON conversation_messages FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM magic_links ml
      WHERE ml.statement_id = conversation_messages.statement_id
      AND ml.used_at IS NULL
      AND ml.expires_at > NOW()
    )
  );

-- ============================================================================
-- AUDIT LOGGING FOR INTAKE ACCESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  magic_link_token TEXT,
  accessed_table TEXT NOT NULL,
  accessed_id UUID,
  ip_address INET,
  user_agent TEXT,
  access_granted BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_token ON access_logs(magic_link_token);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip_address);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role and admins can read access logs"
  ON access_logs FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Anyone can insert access logs"
  ON access_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- INTAKE ACCESS FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_intake_rate_limit(
  p_token TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_max_attempts INT DEFAULT 10,
  p_window_minutes INT DEFAULT 5
)
RETURNS TABLE(allowed BOOLEAN, attempts_count INT, window_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  SELECT COUNT(*)
  INTO v_attempt_count
  FROM public.access_logs
  WHERE created_at > v_window_start
    AND (
      (p_token IS NOT NULL AND magic_link_token = p_token)
      OR
      (p_ip_address IS NOT NULL AND ip_address = p_ip_address)
    );

  RETURN QUERY SELECT
    (v_attempt_count < p_max_attempts),
    v_attempt_count,
    (v_window_start + (p_window_minutes || ' minutes')::INTERVAL);
END;
$$;

CREATE OR REPLACE FUNCTION log_intake_access(
  p_token TEXT,
  p_table TEXT,
  p_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_granted BOOLEAN DEFAULT true,
  p_error TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.access_logs (
    magic_link_token,
    accessed_table,
    accessed_id,
    ip_address,
    user_agent,
    access_granted,
    error_message
  ) VALUES (
    p_token,
    p_table,
    p_id,
    p_ip_address,
    p_user_agent,
    p_granted,
    p_error
  )
  RETURNING id INTO v_log_id;

  IF p_granted AND p_table = 'magic_links' THEN
    UPDATE public.magic_links
    SET
      first_accessed_at = COALESCE(first_accessed_at, NOW()),
      first_access_ip = COALESCE(first_access_ip, p_ip_address),
      last_accessed_at = NOW(),
      access_count = COALESCE(access_count, 0) + 1
    WHERE token = p_token;
  END IF;

  RETURN v_log_id;
END;
$$;
