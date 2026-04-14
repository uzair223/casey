-- Consolidated core schema for fresh database resets
-- Date: 2026-04-10

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  data_retention_days INTEGER NOT NULL DEFAULT 365,
  soft_deleted_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenants_data_retention_days_check
    CHECK (data_retention_days BETWEEN 30 AND 3650)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'paralegal' CHECK (role IN ('app_admin', 'tenant_admin', 'solicitor', 'paralegal')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  title TEXT NOT NULL,
  case_template_id UUID,
  case_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES auth.users ON DELETE SET NULL,
  assigned_to_ids UUID[] NOT NULL DEFAULT '{}',
  incident_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  template_id UUID,
  config_snapshot_id UUID,
  title TEXT NOT NULL,
  witness_name TEXT NOT NULL,
  witness_email TEXT NOT NULL,
  witness_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  gdpr_notice_acknowledgement JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'locked')),
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  supporting_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_document JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.magic_links (
  token TEXT PRIMARY KEY,
  statement_id UUID NOT NULL REFERENCES public.statements ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.statements ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  tenant_id UUID REFERENCES public.tenants ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('paralegal', 'solicitor', 'tenant_admin', 'app_admin')),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waitlist_signups_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_cases_tenant_id ON public.cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON public.cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to_ids ON public.cases USING GIN(assigned_to_ids);
CREATE INDEX IF NOT EXISTS idx_statements_case_id ON public.statements(case_id);
CREATE INDEX IF NOT EXISTS idx_statements_tenant_id ON public.statements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_statement_id ON public.magic_links(statement_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_statement_id ON public.conversation_messages(statement_id);
CREATE INDEX IF NOT EXISTS idx_invites_tenant_id ON public.invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_role ON public.invites(role);
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at ON public.waitlist_signups(created_at DESC);

CREATE OR REPLACE FUNCTION public.user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_magic_link(token_param TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  statement_id UUID,
  tenant_id UUID,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ml.expires_at > NOW())::BOOLEAN,
    ml.statement_id,
    ml.tenant_id,
    ml.expires_at
  FROM public.magic_links ml
  WHERE ml.token = token_param
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.statement_has_valid_magic_link(statement_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.magic_links ml
    WHERE ml.statement_id = statement_id_param
      AND ml.expires_at > NOW()
  );
$$;

CREATE OR REPLACE FUNCTION public.tenant_has_valid_magic_link(tenant_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.magic_links ml
    WHERE ml.tenant_id = tenant_id_param
      AND ml.expires_at > NOW()
  );
$$;

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
      AND t.soft_deleted_at IS NULL
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
    JOIN public.tenants t ON t.id = ml.tenant_id
    WHERE ml.tenant_id::text = bucket_id_param
      AND ml.expires_at > NOW()
      AND t.soft_deleted_at IS NULL
  );
$$;

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

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS statements_updated_at ON public.statements;
CREATE TRIGGER statements_updated_at
  BEFORE UPDATE ON public.statements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS waitlist_signups_updated_at ON public.waitlist_signups;
CREATE TRIGGER waitlist_signups_updated_at
  BEFORE UPDATE ON public.waitlist_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS create_tenant_storage_bucket_trigger ON public.tenants;
CREATE TRIGGER create_tenant_storage_bucket_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_tenant_storage_bucket();

INSERT INTO storage.buckets (id, name, public)
VALUES ('global-templates', 'global-templates', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
SELECT t.id::text, t.id::text, false
FROM public.tenants t
ON CONFLICT (id) DO NOTHING;
