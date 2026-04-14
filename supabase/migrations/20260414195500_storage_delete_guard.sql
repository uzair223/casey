-- Prevent row deletes from failing when storage.objects direct delete is blocked
-- Date: 2026-04-14

CREATE OR REPLACE FUNCTION public.delete_storage_document(
  document_json JSONB,
  default_bucket TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resolved_bucket TEXT;
  resolved_path TEXT;
BEGIN
  IF document_json IS NULL OR jsonb_typeof(document_json) <> 'object' THEN
    RETURN;
  END IF;

  resolved_bucket := COALESCE(document_json ->> 'bucketId', default_bucket);
  resolved_path := document_json ->> 'path';

  IF resolved_bucket IS NULL OR resolved_path IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = resolved_bucket
      AND name = resolved_path;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      -- Newer Supabase storage protections disallow direct table deletes.
      -- File cleanup is handled via Storage API in application code.
      NULL;
  END;
END;
$$;
