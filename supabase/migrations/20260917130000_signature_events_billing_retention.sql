CREATE TABLE IF NOT EXISTS public.statement_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  intent_attested BOOLEAN NOT NULL DEFAULT FALSE,
  method TEXT NOT NULL CHECK (method IN ('canvas', 'dropbox_sign')),
  ip_address TEXT,
  user_agent TEXT,
  unsigned_document_sha256 TEXT,
  signed_document_sha256 TEXT,
  dropbox_signature_request_id TEXT,
  dropbox_signature_id TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statement_signature_events_statement
  ON public.statement_signature_events(statement_id, signed_at DESC);

ALTER TABLE public.statement_signature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read signature events"
  ON public.statement_signature_events FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
    OR public.user_role() = 'app_admin'
  );

CREATE POLICY "Service role can manage signature events"
  ON public.statement_signature_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS dpa_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_firm_name TEXT,
  ADD COLUMN IF NOT EXISTS order_start_date DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_billing_status_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_billing_status_check
      CHECK (billing_status IN ('trial', 'active', 'past_due', 'canceled'));
  END IF;
END $$;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_seat_limit_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_seat_limit_check
  CHECK (seat_limit >= 0);

CREATE OR REPLACE FUNCTION public.soft_delete_tenant(tenant_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  SELECT GREATEST(1, data_retention_days)
  INTO retention_days
  FROM public.tenants
  WHERE id = tenant_id_param;

  IF retention_days IS NULL THEN
    retention_days := 90;
  END IF;

  UPDATE public.tenants
  SET
    soft_deleted_at = NOW(),
    purge_after = NOW() + make_interval(days => retention_days),
    soft_deleted_by_role = public.user_role()
  WHERE id = tenant_id_param
    AND soft_deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.permanently_delete_expired_soft_deleted_tenants()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.tenants
    WHERE soft_deleted_at IS NOT NULL
      AND COALESCE(
        purge_after,
        soft_deleted_at + make_interval(days => GREATEST(1, data_retention_days))
      ) <= NOW()
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;

  RETURN COALESCE(deleted_count, 0);
END;
$$;
