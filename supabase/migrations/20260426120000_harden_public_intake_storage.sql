-- Public intake traffic now goes through server-side API routes that validate
-- the statement token before using the service role for storage operations.
-- Direct anonymous Supabase access to magic-link rows and tenant buckets is no
-- longer required and was too broad for tenant-scoped evidence storage.

DROP POLICY IF EXISTS "Unauthenticated users can read valid magic links"
  ON public.magic_links;

DROP POLICY IF EXISTS "Anon can upload to tenant buckets via magic link"
  ON storage.objects;

DROP POLICY IF EXISTS "Anon can read from tenant buckets via magic link"
  ON storage.objects;
