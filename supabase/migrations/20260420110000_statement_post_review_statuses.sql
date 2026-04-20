ALTER TABLE public.statements
DROP CONSTRAINT IF EXISTS statements_status_check;

ALTER TABLE public.statements
ADD CONSTRAINT statements_status_check
CHECK (
  status IN (
    'draft',
    'in_progress',
    'submitted',
    'finalized',
    'completed',
    'locked',
    'demo',
    'demo_published'
  )
);
