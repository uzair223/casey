-- Migration: Add public waitlist signups
-- Date: 2026-03-05

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

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created_at
  ON public.waitlist_signups(created_at DESC);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER waitlist_signups_updated_at
  BEFORE UPDATE ON public.waitlist_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

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
