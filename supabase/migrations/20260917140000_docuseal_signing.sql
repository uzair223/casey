ALTER TABLE public.statement_signature_events
  DROP CONSTRAINT IF EXISTS statement_signature_events_method_check;

ALTER TABLE public.statement_signature_events
  ADD CONSTRAINT statement_signature_events_method_check
  CHECK (method IN ('canvas', 'dropbox_sign', 'docuseal'));

ALTER TABLE public.statement_signature_events
  ADD COLUMN IF NOT EXISTS docuseal_submission_id TEXT,
  ADD COLUMN IF NOT EXISTS docuseal_submitter_id TEXT,
  ADD COLUMN IF NOT EXISTS docuseal_submitter_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_statement_signature_events_docuseal_submission
  ON public.statement_signature_events(docuseal_submission_id);
