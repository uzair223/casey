ALTER TABLE public.lead_sessions
  ADD COLUMN IF NOT EXISTS attribution JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.lead_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  spend_by_click JSONB NOT NULL DEFAULT '{}'::jsonb,
  spend_refreshed_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_ad_accounts_provider_check CHECK (provider IN ('google', 'meta')),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS public.lead_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_campaign_id TEXT,
  status TEXT NOT NULL DEFAULT 'paused',
  monthly_budget_gbp INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_campaigns_provider_check CHECK (provider IN ('google', 'meta')),
  CONSTRAINT lead_campaigns_status_check CHECK (status IN ('live', 'paused')),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS public.crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  webhook_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  external_account_id TEXT,
  region TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_connections_provider_check CHECK (provider IN ('clio', 'webhook')),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS public.crm_pushes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_pushes_status_check CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_crm_pushes_statement
  ON public.crm_pushes(tenant_id, statement_id, created_at DESC);

ALTER TABLE public.lead_ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pushes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.lead_ad_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.lead_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_pushes FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.lead_ad_accounts TO service_role;
GRANT ALL ON TABLE public.lead_campaigns TO service_role;
GRANT ALL ON TABLE public.crm_pushes TO service_role;
GRANT ALL ON TABLE public.crm_connections TO service_role;

DROP TRIGGER IF EXISTS lead_ad_accounts_updated_at ON public.lead_ad_accounts;
CREATE TRIGGER lead_ad_accounts_updated_at
  BEFORE UPDATE ON public.lead_ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS lead_campaigns_updated_at ON public.lead_campaigns;
CREATE TRIGGER lead_campaigns_updated_at
  BEFORE UPDATE ON public.lead_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS crm_connections_updated_at ON public.crm_connections;
CREATE TRIGGER crm_connections_updated_at
  BEFORE UPDATE ON public.crm_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
