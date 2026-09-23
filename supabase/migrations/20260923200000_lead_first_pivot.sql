-- Lead-first pivot.
-- A lead is the primary statement. Supporting people point at that row.
-- Case rows stay so existing notes, files, analysis, and storage paths keep working.
-- New matter fields live on the primary statement.

ALTER TABLE public.statements
  ADD COLUMN IF NOT EXISTS parent_statement_id UUID REFERENCES public.statements(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS participant_kind TEXT NOT NULL DEFAULT 'supporting',
  ADD COLUMN IF NOT EXISTS role_key TEXT NOT NULL DEFAULT 'witness',
  ADD COLUMN IF NOT EXISTS lead_stage TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS qualification_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_type_id UUID REFERENCES public.case_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.statements
  DROP CONSTRAINT IF EXISTS statements_participant_kind_check;
ALTER TABLE public.statements
  ADD CONSTRAINT statements_participant_kind_check
  CHECK (participant_kind IN ('primary', 'supporting'));

ALTER TABLE public.statements
  DROP CONSTRAINT IF EXISTS statements_lead_stage_check;
ALTER TABLE public.statements
  ADD CONSTRAINT statements_lead_stage_check
  CHECK (
    lead_stage IS NULL
    OR lead_stage IN (
      'qualifying',
      'new',
      'declined',
      'intake',
      'review',
      'final_review',
      'completed',
      'locked'
    )
  );

ALTER TABLE public.statements
  DROP CONSTRAINT IF EXISTS statements_primary_parent_check;
ALTER TABLE public.statements
  ADD CONSTRAINT statements_primary_parent_check
  CHECK (
    (participant_kind = 'primary' AND parent_statement_id IS NULL)
    OR participant_kind = 'supporting'
  );

CREATE INDEX IF NOT EXISTS idx_statements_parent_statement_id
  ON public.statements(parent_statement_id);
CREATE INDEX IF NOT EXISTS idx_statements_primary_tenant
  ON public.statements(tenant_id, created_at DESC)
  WHERE participant_kind = 'primary';
CREATE INDEX IF NOT EXISTS idx_statements_contact_email
  ON public.statements(tenant_id, lower(contact_email))
  WHERE contact_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_statements_contact_phone
  ON public.statements(tenant_id, contact_phone)
  WHERE contact_phone IS NOT NULL;

-- Classify existing statements once. contact_name is still null on pre-pivot rows.
WITH ranked AS (
  SELECT
    s.id,
    s.case_id,
    s.created_at,
    row_number() OVER (
      PARTITION BY s.case_id
      ORDER BY s.created_at ASC, s.id ASC
    ) AS rn
  FROM public.statements s
  WHERE s.contact_name IS NULL
    AND s.lead_stage IS NULL
    AND s.parent_statement_id IS NULL
)
UPDATE public.statements s
SET
  participant_kind = CASE WHEN ranked.rn = 1 THEN 'primary' ELSE 'supporting' END,
  role_key = CASE WHEN ranked.rn = 1 THEN 'claimant' ELSE 'witness' END,
  parent_statement_id = CASE
    WHEN ranked.rn = 1 THEN NULL
    ELSE (
      SELECT primary_row.id
      FROM ranked primary_row
      WHERE primary_row.case_id = ranked.case_id
        AND primary_row.rn = 1
    )
  END,
  lead_stage = CASE
    WHEN ranked.rn = 1 THEN
      CASE c.status
        WHEN 'draft' THEN 'new'
        WHEN 'submitted' THEN 'review'
        WHEN 'locked' THEN 'locked'
        ELSE 'intake'
      END
    ELSE NULL
  END,
  contact_name = s.witness_name,
  contact_email = NULLIF(s.witness_email, ''),
  lead_type_id = c.case_template_id,
  qualification_answers = COALESCE(c.case_metadata, '{}'::jsonb),
  assigned_to = c.assigned_to,
  assigned_to_ids = COALESCE(c.assigned_to_ids, '{}'::uuid[]),
  accepted_at = CASE WHEN ranked.rn = 1 THEN s.created_at ELSE s.accepted_at END
FROM ranked
JOIN public.cases c ON c.id = ranked.case_id
WHERE s.id = ranked.id;

ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS primary_statement_id UUID REFERENCES public.statements(id) ON DELETE CASCADE;
ALTER TABLE public.case_documents
  ADD COLUMN IF NOT EXISTS primary_statement_id UUID REFERENCES public.statements(id) ON DELETE CASCADE;
ALTER TABLE public.case_analysis_snapshots
  ADD COLUMN IF NOT EXISTS primary_statement_id UUID REFERENCES public.statements(id) ON DELETE CASCADE;

UPDATE public.case_notes n
SET primary_statement_id = s.id
FROM public.statements s
WHERE n.primary_statement_id IS NULL
  AND s.case_id = n.case_id
  AND s.participant_kind = 'primary';

UPDATE public.case_documents d
SET primary_statement_id = s.id
FROM public.statements s
WHERE d.primary_statement_id IS NULL
  AND s.case_id = d.case_id
  AND s.participant_kind = 'primary';

UPDATE public.case_analysis_snapshots a
SET primary_statement_id = s.id
FROM public.statements s
WHERE a.primary_statement_id IS NULL
  AND s.case_id = a.case_id
  AND s.participant_kind = 'primary';

CREATE INDEX IF NOT EXISTS idx_case_notes_primary_statement
  ON public.case_notes(primary_statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_documents_primary_statement
  ON public.case_documents(primary_statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_analysis_primary_statement
  ON public.case_analysis_snapshots(primary_statement_id, created_at DESC);

ALTER TABLE public.case_templates
  ADD COLUMN IF NOT EXISTS qualification_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS outreach_template TEXT,
  ADD COLUMN IF NOT EXISTS public_slug TEXT,
  ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decline_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_templates_public_slug
  ON public.case_templates(public_slug)
  WHERE public_slug IS NOT NULL;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS public_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_public_slug
  ON public.tenants(lower(public_slug))
  WHERE public_slug IS NOT NULL;

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('trial', 'starter', 'growth', 'practice', 'firm'));

UPDATE public.tenants SET plan = 'starter' WHERE plan = 'practice';
UPDATE public.tenants SET plan = 'growth' WHERE plan = 'firm';

CREATE TABLE IF NOT EXISTS public.lead_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_type_id UUID NOT NULL REFERENCES public.case_templates(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, lead_type_id)
);

CREATE TABLE IF NOT EXISTS public.lead_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_type_id UUID NOT NULL REFERENCES public.case_templates(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.lead_channels(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  slots JSONB NOT NULL DEFAULT '{}'::jsonb,
  pending_slot_id TEXT,
  turn_count INTEGER NOT NULL DEFAULT 0,
  refusal_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  contact_code_hash TEXT,
  contact_code_expires_at TIMESTAMPTZ,
  promoted_statement_id UUID REFERENCES public.statements(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_sessions_status_check
    CHECK (status IN ('open', 'verify', 'promoted', 'expired', 'closed', 'fallback'))
);

CREATE INDEX IF NOT EXISTS idx_lead_channels_tenant
  ON public.lead_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_sessions_tenant_created
  ON public.lead_sessions(tenant_id, created_at DESC);

ALTER TABLE public.lead_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS lead_channels_updated_at ON public.lead_channels;
CREATE TRIGGER lead_channels_updated_at
  BEFORE UPDATE ON public.lead_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS lead_sessions_updated_at ON public.lead_sessions;
CREATE TRIGGER lead_sessions_updated_at
  BEFORE UPDATE ON public.lead_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.case_templates (
  name,
  status,
  template_scope,
  draft_config,
  published_config,
  published_at,
  title_template,
  qualification_slots,
  participant_roles,
  outreach_template,
  public_slug,
  branding,
  decline_reasons
)
SELECT
  'Personal injury',
  'published',
  'global',
  '{"dynamicFields":[]}'::jsonb,
  '{"dynamicFields":[]}'::jsonb,
  NOW(),
  '{name} — {when}',
  '[
    {"id":"name","label":"Your name","type":"text","required":true,"reserved":"name"},
    {"id":"email","label":"Email","type":"text","required":false,"reserved":"email"},
    {"id":"phone","label":"Phone","type":"text","required":false,"reserved":"phone"},
    {"id":"what","label":"What happened","type":"long_text","required":true},
    {"id":"when","label":"When it happened","type":"date","required":true,"include_in_outreach":true},
    {"id":"harm","label":"What harm or loss followed","type":"long_text","required":true}
  ]'::jsonb,
  '[
    {"key":"claimant","label":"Claimant","kind":"primary"},
    {"key":"witness","label":"Witness","kind":"supporting"}
  ]'::jsonb,
  'Hi, you were named as a {role} for {firm} regarding {summary}. We are kindly requesting your account.',
  'personal-injury',
  '{}'::jsonb,
  '[
    {"key":"limitation","label":"Out of time"},
    {"key":"no_loss","label":"No loss described"}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.case_templates
  WHERE template_scope = 'global'
    AND public_slug = 'personal-injury'
);

-- The primary person is the lead, not one of the three supporting accounts.
CREATE OR REPLACE FUNCTION public.enforce_trial_witness_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_plan text;
  witness_count integer;
BEGIN
  SELECT plan INTO tenant_plan
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF tenant_plan IS DISTINCT FROM 'trial' THEN
    RETURN NEW;
  END IF;

  IF NEW.participant_kind IS DISTINCT FROM 'supporting' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO witness_count
  FROM public.statements
  WHERE case_id = NEW.case_id
    AND participant_kind = 'supporting';

  IF witness_count >= 3 THEN
    RAISE EXCEPTION 'trial_witness_cap'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
