ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS intake_branding JSONB NOT NULL DEFAULT '{}'::jsonb;

-- The seeded Demo organisation was given the public address "demo" and two
-- disabled lead channels. That hosted page collided with the demo firm.
DELETE FROM public.lead_channels
WHERE tenant_id IN (
  SELECT id
  FROM public.tenants
  WHERE lower(name) = 'demo'
    AND lower(public_slug) = 'demo'
);

UPDATE public.tenants
SET public_slug = NULL
WHERE lower(name) = 'demo'
  AND lower(public_slug) = 'demo';
