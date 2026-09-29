ALTER TABLE public.statements
DROP CONSTRAINT IF EXISTS statements_status_check;

ALTER TABLE public.statements
ADD CONSTRAINT statements_status_check
CHECK (
  status IN (
    'draft',
    'extracted',
    'waiting_for_response',
    'in_progress',
    'submitted',
    'finalized',
    'completed',
    'locked',
    'demo',
    'demo_published'
  )
);

UPDATE public.statements
SET status = 'extracted'
WHERE status = 'draft'
  AND participant_kind = 'supporting'
  AND outreach_confirmed_at IS NULL
  AND witness_metadata->>'source' = 'extracted';
