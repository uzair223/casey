-- Backfill published case templates missing published_config
-- Date: 2026-04-14

UPDATE public.case_templates
SET published_config = draft_config,
    updated_at = NOW()
WHERE status = 'published'
  AND published_config IS NULL;
