ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ad_targeting JSONB NOT NULL DEFAULT '{}'::jsonb;
