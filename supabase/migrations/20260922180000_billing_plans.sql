-- Practice, Firm, and one-off cases replace the 7-day seat trial.
-- Case rows are inserted by the service role so the allowance cannot be skipped.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS overage_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_overage_checkout_session_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_plan_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_plan_check
      CHECK (plan IN ('trial', 'practice', 'firm'));
  END IF;
END $$;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_overage_credits_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_overage_credits_check
  CHECK (overage_credits >= 0);

DROP POLICY IF EXISTS "Tenant case managers can create cases" ON public.cases;
