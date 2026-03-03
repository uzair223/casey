-- Migration: Add multi-assignment support for statements
-- Date: 2026-03-03

ALTER TABLE public.statements
ADD COLUMN IF NOT EXISTS assigned_to_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE public.statements
SET assigned_to_ids = ARRAY[assigned_to]
WHERE assigned_to IS NOT NULL
  AND (assigned_to_ids IS NULL OR cardinality(assigned_to_ids) = 0);

CREATE INDEX IF NOT EXISTS idx_statements_assigned_to_ids
  ON public.statements USING GIN(assigned_to_ids);
