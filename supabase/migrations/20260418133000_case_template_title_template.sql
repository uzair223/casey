-- Add title template column for case templates.
-- This is stored as a first-class column (not in draft/published config JSON).
ALTER TABLE public.case_templates
ADD COLUMN IF NOT EXISTS title_template TEXT NOT NULL DEFAULT 'Case {caseIndex}';

-- Backfill any empty values to the default template.
UPDATE public.case_templates
SET title_template = 'Case {caseIndex}'
WHERE title_template IS NULL OR btrim(title_template) = '';
