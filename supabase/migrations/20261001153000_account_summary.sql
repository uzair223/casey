ALTER TABLE public.statement_formalization_snapshots
  ADD COLUMN IF NOT EXISTS summary TEXT;
