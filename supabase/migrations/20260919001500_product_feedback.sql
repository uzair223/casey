-- First-party witness CSAT and signed-in firm feedback. App-admin readable;
-- writes go through service-role API routes, not the browser client.

CREATE TABLE IF NOT EXISTS public.product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('witness_survey', 'firm_feedback')),
  kind TEXT NOT NULL CHECK (kind IN ('survey', 'bug', 'idea')),
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  message TEXT,
  page_path TEXT,
  user_agent TEXT,
  statement_id UUID REFERENCES public.statements(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  submitted_by_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_feedback_source_shape CHECK (
    (
      source = 'witness_survey'
      AND kind = 'survey'
      AND rating BETWEEN 1 AND 5
    )
    OR (
      source = 'firm_feedback'
      AND kind IN ('bug', 'idea')
      AND message IS NOT NULL
      AND char_length(btrim(message)) > 0
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_feedback_one_witness_survey_per_statement
  ON public.product_feedback (statement_id)
  WHERE source = 'witness_survey' AND statement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_feedback_created_at
  ON public.product_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_source
  ON public.product_feedback (source);

DROP TRIGGER IF EXISTS product_feedback_updated_at ON public.product_feedback;
CREATE TRIGGER product_feedback_updated_at
  BEFORE UPDATE ON public.product_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS audit_product_feedback ON public.product_feedback;
CREATE TRIGGER audit_product_feedback
  AFTER INSERT OR UPDATE OR DELETE ON public.product_feedback
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App admins can read product feedback"
  ON public.product_feedback FOR SELECT
  TO authenticated
  USING (public.user_role() = 'app_admin');

CREATE POLICY "Service role can insert product feedback"
  ON public.product_feedback FOR INSERT
  TO service_role
  WITH CHECK (true);
