-- Unify witness and internal statement supporting documents.
-- Date: 2026-04-30

CREATE TABLE IF NOT EXISTS public.statement_supporting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  uploaded_by_type TEXT NOT NULL,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_witness_name TEXT,
  uploaded_by_witness_email TEXT,
  title TEXT NOT NULL,
  group_name TEXT,
  document JSONB NOT NULL,
  descriptor_status TEXT NOT NULL DEFAULT 'pending',
  descriptors JSONB NOT NULL DEFAULT '{}'::jsonb,
  descriptor_model TEXT,
  descriptor_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statement_supporting_documents_statement_created_at
  ON public.statement_supporting_documents(statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_statement_supporting_documents_tenant_created_at
  ON public.statement_supporting_documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_statement_supporting_documents_case_created_at
  ON public.statement_supporting_documents(case_id, created_at DESC);

DROP TRIGGER IF EXISTS statement_supporting_documents_updated_at
  ON public.statement_supporting_documents;
CREATE TRIGGER statement_supporting_documents_updated_at
  BEFORE UPDATE ON public.statement_supporting_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.statement_supporting_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view statement supporting documents"
  ON public.statement_supporting_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert statement supporting documents"
  ON public.statement_supporting_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND uploaded_by_type = 'internal_user'
    AND uploaded_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can update statement supporting documents"
  ON public.statement_supporting_documents FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete statement supporting documents"
  ON public.statement_supporting_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can manage statement supporting documents"
  ON public.statement_supporting_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

WITH migrated_witness_documents AS (
  INSERT INTO public.statement_supporting_documents (
    tenant_id,
    case_id,
    statement_id,
    uploaded_by_type,
    uploaded_by_witness_name,
    uploaded_by_witness_email,
    title,
    group_name,
    document,
    descriptor_status,
    descriptors,
    created_at,
    updated_at
  )
  SELECT
    statements.tenant_id,
    statements.case_id,
    statements.id,
    'witness',
    statements.witness_name,
    statements.witness_email,
    COALESCE(NULLIF(document_item.document ->> 'name', ''), 'Supporting document'),
    NULLIF(document_item.document ->> 'group', ''),
    document_item.document,
    CASE
      WHEN NULLIF(document_item.document ->> 'description', '') IS NULL THEN 'pending'
      ELSE 'generated'
    END,
    CASE
      WHEN NULLIF(document_item.document ->> 'description', '') IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('summary', document_item.document ->> 'description')
    END,
    COALESCE((document_item.document ->> 'uploadedAt')::timestamptz, statements.created_at),
    NOW()
  FROM public.statements
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(statements.supporting_documents) = 'array'
        THEN statements.supporting_documents
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS document_item(document, ordinal)
  WHERE jsonb_typeof(document_item.document) = 'object'
    AND document_item.document ? 'path'
  RETURNING id, statement_id, created_at
),
migrated_internal_documents AS (
  INSERT INTO public.statement_supporting_documents (
    tenant_id,
    case_id,
    statement_id,
    uploaded_by_type,
    uploaded_by_user_id,
    title,
    group_name,
    document,
    descriptor_status,
    created_at,
    updated_at
  )
  SELECT
    internal_documents.tenant_id,
    statements.case_id,
    internal_documents.statement_id,
    'internal_user',
    internal_documents.uploaded_by_user_id,
    COALESCE(NULLIF(internal_documents.document ->> 'name', ''), 'Supporting document'),
    NULLIF(internal_documents.document ->> 'group', ''),
    internal_documents.document,
    'pending',
    internal_documents.created_at,
    NOW()
  FROM public.statement_internal_documents internal_documents
  JOIN public.statements
    ON statements.id = internal_documents.statement_id
  RETURNING id, statement_id, created_at
),
all_migrated_documents AS (
  SELECT * FROM migrated_witness_documents
  UNION ALL
  SELECT * FROM migrated_internal_documents
),
ordered_statement_documents AS (
  SELECT
    statement_id,
    jsonb_agg(to_jsonb(id::text) ORDER BY created_at ASC) AS document_ids
  FROM all_migrated_documents
  GROUP BY statement_id
)
UPDATE public.statements
SET supporting_documents = ordered_statement_documents.document_ids
FROM ordered_statement_documents
WHERE statements.id = ordered_statement_documents.statement_id;

UPDATE public.statements
SET supporting_documents = '[]'::jsonb
WHERE supporting_documents IS NULL
   OR jsonb_typeof(supporting_documents) <> 'array';

DROP TABLE IF EXISTS public.statement_internal_documents;
