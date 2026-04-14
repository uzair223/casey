-- Link snapshots to owning records and clean up storage objects on delete
-- Date: 2026-04-14

-- 1) Link statement snapshots to statements for cascade delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'statement_config_snapshots'
      AND column_name = 'created_for_statement_id'
  ) THEN
    ALTER TABLE public.statement_config_snapshots
      ADD COLUMN created_for_statement_id UUID;
  END IF;
END $$;

-- Backfill ownership from current statement -> snapshot links
UPDATE public.statement_config_snapshots scs
SET created_for_statement_id = s.id
FROM public.statements s
WHERE s.config_snapshot_id = scs.id
  AND scs.created_for_statement_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'statement_config_snapshots_created_for_statement_id_fkey'
  ) THEN
    ALTER TABLE public.statement_config_snapshots
      ADD CONSTRAINT statement_config_snapshots_created_for_statement_id_fkey
      FOREIGN KEY (created_for_statement_id)
      REFERENCES public.statements(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_statement_config_snapshots_created_for_statement
  ON public.statement_config_snapshots(created_for_statement_id);

-- 2) Link case snapshots to cases for cascade delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'case_config_snapshots'
      AND column_name = 'created_for_case_id'
  ) THEN
    ALTER TABLE public.case_config_snapshots
      ADD COLUMN created_for_case_id UUID;
  END IF;
END $$;

-- Backfill ownership from current case -> snapshot links
UPDATE public.case_config_snapshots ccs
SET created_for_case_id = c.id
FROM public.cases c
WHERE c.config_snapshot_id = ccs.id
  AND ccs.created_for_case_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'case_config_snapshots_created_for_case_id_fkey'
  ) THEN
    ALTER TABLE public.case_config_snapshots
      ADD CONSTRAINT case_config_snapshots_created_for_case_id_fkey
      FOREIGN KEY (created_for_case_id)
      REFERENCES public.cases(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_case_config_snapshots_created_for_case
  ON public.case_config_snapshots(created_for_case_id);

-- 3) Helper to remove a single stored document
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

  DELETE FROM storage.objects
  WHERE bucket_id = resolved_bucket
    AND name = resolved_path;
END;
$$;

-- 4) Cleanup trigger for statement row documents
CREATE OR REPLACE FUNCTION public.cleanup_statement_storage_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supporting_doc JSONB;
BEGIN
  PERFORM public.delete_storage_document(OLD.signed_document, OLD.tenant_id::text);

  IF OLD.supporting_documents IS NOT NULL
     AND jsonb_typeof(OLD.supporting_documents) = 'array' THEN
    FOR supporting_doc IN
      SELECT value
      FROM jsonb_array_elements(OLD.supporting_documents)
    LOOP
      PERFORM public.delete_storage_document(supporting_doc, OLD.tenant_id::text);
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_statement_storage_documents_trigger ON public.statements;
CREATE TRIGGER cleanup_statement_storage_documents_trigger
  BEFORE DELETE ON public.statements
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_statement_storage_documents();

-- 5) Cleanup trigger for snapshot template documents
CREATE OR REPLACE FUNCTION public.cleanup_snapshot_template_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_bucket TEXT;
BEGIN
  default_bucket := NULL;

  IF TG_TABLE_NAME = 'statement_config_snapshots' OR TG_TABLE_NAME = 'case_config_snapshots' THEN
    default_bucket := OLD.tenant_id::text;
  END IF;

  PERFORM public.delete_storage_document(OLD.template_document, default_bucket);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_statement_snapshot_template_document_trigger ON public.statement_config_snapshots;
CREATE TRIGGER cleanup_statement_snapshot_template_document_trigger
  BEFORE DELETE ON public.statement_config_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_snapshot_template_document();

DROP TRIGGER IF EXISTS cleanup_case_snapshot_template_document_trigger ON public.case_config_snapshots;
CREATE TRIGGER cleanup_case_snapshot_template_document_trigger
  BEFORE DELETE ON public.case_config_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_snapshot_template_document();
