-- Add draft/published DOCX document columns for statement templates
ALTER TABLE public.statement_config_templates
ADD COLUMN IF NOT EXISTS draft_docx_template_document JSONB,
ADD COLUMN IF NOT EXISTS published_docx_template_document JSONB;

-- Backfill from legacy single document column
UPDATE public.statement_config_templates
SET draft_docx_template_document = COALESCE(
      draft_docx_template_document,
      docx_template_document
    ),
    published_docx_template_document = COALESCE(
      published_docx_template_document,
      docx_template_document
    )
WHERE docx_template_document IS NOT NULL;

-- Remove legacy single document column after backfill
ALTER TABLE public.statement_config_templates
DROP COLUMN IF EXISTS docx_template_document;
