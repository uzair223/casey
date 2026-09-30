ALTER TABLE public.statement_signature_events
  DROP CONSTRAINT IF EXISTS statement_signature_events_method_check;

ALTER TABLE public.statement_signature_events
  ADD CONSTRAINT statement_signature_events_method_check
  CHECK (method IN ('canvas', 'dropbox_sign'));

DROP INDEX IF EXISTS idx_statement_signature_events_docuseal_submission;

ALTER TABLE public.statement_signature_events
  DROP COLUMN IF EXISTS docuseal_submission_id,
  DROP COLUMN IF EXISTS docuseal_submitter_id,
  DROP COLUMN IF EXISTS docuseal_submitter_slug;

ALTER TABLE public.statement_signature_events
  ADD COLUMN IF NOT EXISTS signature_image_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS attestation_text TEXT;
