ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_soft_deleted_at
  ON public.profiles(tenant_id, soft_deleted_at);