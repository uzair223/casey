-- The primary statement is the file. Case rows and case-template rows are removed
-- rather than migrated. Shared facts live on statement_matters. Lead types are
-- primary statement templates.

ALTER TABLE public.statement_config_templates
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'supporting',
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS outreach_template text,
  ADD COLUMN IF NOT EXISTS decline_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qualification_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS title_template text,
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS matter_config jsonb,
  ADD COLUMN IF NOT EXISTS brief_guidance text;

ALTER TABLE public.statement_config_templates
  DROP CONSTRAINT IF EXISTS statement_config_templates_kind_check;
ALTER TABLE public.statement_config_templates
  ADD CONSTRAINT statement_config_templates_kind_check
  CHECK (kind IN ('primary', 'supporting'));

-- Copy the public lead type onto its default interview template.
UPDATE public.statement_config_templates AS statement_template
SET
  kind = 'primary',
  name = case_template.name,
  public_slug = case_template.public_slug,
  outreach_template = case_template.outreach_template,
  decline_reasons = COALESCE(case_template.decline_reasons, '[]'::jsonb),
  qualification_slots = COALESCE(case_template.qualification_slots, '[]'::jsonb),
  participant_roles = COALESCE(case_template.participant_roles, '[]'::jsonb),
  title_template = case_template.title_template,
  branding = COALESCE(case_template.branding, '{}'::jsonb),
  matter_config = case_template.published_config
FROM public.case_template_statement_templates AS link
JOIN public.case_templates AS case_template
  ON case_template.id = link.case_template_id
WHERE link.statement_template_id = statement_template.id
  AND link.is_default = true;

UPDATE public.statement_config_templates
SET
  name = 'RTA',
  public_slug = 'rta',
  brief_guidance = 'Role in the vehicle, the collision, and the harm. Never include a name, email, phone, or street address.'
WHERE id = '22222222-2222-4222-8222-222222222201';

UPDATE public.statement_config_templates
SET
  name = 'Employer Liability',
  public_slug = 'employer-liability',
  brief_guidance = 'Role, employer, what happened, the harm, and the kind of place. Never include a name, email, phone, or street address.'
WHERE id = '22222222-2222-4222-8222-222222222203';

UPDATE public.statement_config_templates
SET
  name = 'Public Liability',
  public_slug = 'public-liability',
  brief_guidance = 'The kind of place, how they were hurt, and the harm. Never include a name, email, phone, or street address.'
WHERE id = '22222222-2222-4222-8222-222222222205';

UPDATE public.statement_config_templates
SET
  name = 'Clinical Negligence',
  public_slug = 'clinical-negligence',
  brief_guidance = 'The care and what went wrong. Never include a name, email, phone, or street address.'
WHERE id = '22222222-2222-4222-8222-222222222207';

UPDATE public.statement_config_templates
SET
  name = 'Housing Disrepair',
  public_slug = 'housing-disrepair',
  kind = 'primary',
  brief_guidance = 'The disrepair and who lives there. Never include a name, email, phone, or street address.'
WHERE public_slug = 'housing-disrepair'
   OR id IN (
     SELECT link.statement_template_id
     FROM public.case_template_statement_templates AS link
     JOIN public.case_templates AS case_template
       ON case_template.id = link.case_template_id
     WHERE case_template.public_slug = 'housing-disrepair'
       AND link.is_default = true
   );

INSERT INTO public.statement_config_templates (
  id, tenant_id, name, status, template_scope, kind, public_slug,
  title_template, brief_guidance, outreach_template, decline_reasons,
  qualification_slots, participant_roles, branding, matter_config,
  draft_config, published_config, published_at
)
SELECT
  '22222222-2222-4222-8222-222222222209',
  NULL,
  'Housing Disrepair',
  'published',
  'global',
  'primary',
  'housing-disrepair',
  '{claimant} v {defendant}',
  'The disrepair and who lives there. Never include a name, email, phone, or street address.',
  'Hi, you were named as a {role} for {firm} regarding {summary}. We are kindly requesting your account.',
  '[{"key":"no_disrepair","label":"No disrepair described"}]'::jsonb,
  '[
    {"id":"name","label":"Your name","type":"text","required":true,"reserved":"name"},
    {"id":"email","label":"Email","type":"text","required":false,"reserved":"email"},
    {"id":"phone","label":"Phone","type":"text","required":false,"reserved":"phone"},
    {"id":"what","label":"What happened","type":"long_text","required":true},
    {"id":"when","label":"When it happened","type":"date","required":true,"include_in_outreach":true},
    {"id":"harm","label":"What harm followed","type":"long_text","required":true}
  ]'::jsonb,
  '[
    {"key":"tenant","label":"Tenant","kind":"primary","statement_template_id":"22222222-2222-4222-8222-222222222209"},
    {"key":"household","label":"Household member","kind":"supporting","statement_template_id":"22222222-2222-4222-8222-222222222210"}
  ]'::jsonb,
  '{}'::jsonb,
  '{"matterBrief":"Housing disrepair. The review should follow the condition of the home, who lives there, and what was reported.","dynamicFields":[{"id":"claimant","label":"Claimant","type":"text","description":"The person bringing the claim."},{"id":"defendant","label":"Landlord","type":"text","description":"The landlord alleged to be responsible."},{"id":"disrepairDate","label":"When it was reported","type":"date","description":"When the disrepair was reported."},{"id":"property","label":"Property","type":"text","description":"The kind of home, without a street address."}]}'::jsonb,
  '{"schemaVersion":4,"modelIdentity":"You are interviewing the tenant about disrepair in their home. Take their account of the condition, who lives there, and what they reported.","phases":[{"id":"theHome","title":"The home","objective":"Who lives there and what kind of home it is.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Who lives there","Kind of home"],"questioningMode":"structured"},{"id":"theDisrepair","title":"The disrepair","objective":"What is wrong with the home and how long it has been like that.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["What is wrong","How long it has been wrong"],"questioningMode":"narrative"},{"id":"whatTheyReported","title":"What they reported","objective":"Who they told and what happened after they reported it.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Who they told","What followed the report"],"questioningMode":"narrative"},{"id":"theEffect","title":"The effect","objective":"How the disrepair has affected the people who live there.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Effect on daily life","Effect on health"],"questioningMode":"narrative"}],"sections":[{"id":"introduction","title":"Introduction","description":"Who the tenant is and who lives in the home."},{"id":"theDisrepair","title":"The disrepair","description":"The condition of the home."},{"id":"whatTheyReported","title":"What I reported","description":"Reports to the landlord and what followed."},{"id":"theEffect","title":"The effect","description":"How the disrepair has affected the household."}],"witnessMetadataFields":[{"id":"address","label":"Address","description":"The witness residential address.","requiredOnIntake":true,"requiredOnCreate":false},{"id":"occupation","label":"Occupation","description":"The witness occupation.","requiredOnIntake":false,"requiredOnCreate":false}],"caseMetadataDeps":["claimant","defendant","disrepairDate","property"]}'::jsonb,
  '{"schemaVersion":4,"modelIdentity":"You are interviewing the tenant about disrepair in their home. Take their account of the condition, who lives there, and what they reported.","phases":[{"id":"theHome","title":"The home","objective":"Who lives there and what kind of home it is.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Who lives there","Kind of home"],"questioningMode":"structured"},{"id":"theDisrepair","title":"The disrepair","objective":"What is wrong with the home and how long it has been like that.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["What is wrong","How long it has been wrong"],"questioningMode":"narrative"},{"id":"whatTheyReported","title":"What they reported","objective":"Who they told and what happened after they reported it.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Who they told","What followed the report"],"questioningMode":"narrative"},{"id":"theEffect","title":"The effect","objective":"How the disrepair has affected the people who live there.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Effect on daily life","Effect on health"],"questioningMode":"narrative"}],"sections":[{"id":"introduction","title":"Introduction","description":"Who the tenant is and who lives in the home."},{"id":"theDisrepair","title":"The disrepair","description":"The condition of the home."},{"id":"whatTheyReported","title":"What I reported","description":"Reports to the landlord and what followed."},{"id":"theEffect","title":"The effect","description":"How the disrepair has affected the household."}],"witnessMetadataFields":[{"id":"address","label":"Address","description":"The witness residential address.","requiredOnIntake":true,"requiredOnCreate":false},{"id":"occupation","label":"Occupation","description":"The witness occupation.","requiredOnIntake":false,"requiredOnCreate":false}],"caseMetadataDeps":["claimant","defendant","disrepairDate","property"]}'::jsonb,
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.statement_config_templates
  WHERE kind = 'primary' AND public_slug = 'housing-disrepair'
);

INSERT INTO public.statement_config_templates (
  id, tenant_id, name, status, template_scope, kind,
  draft_config, published_config, published_at
)
SELECT
  '22222222-2222-4222-8222-222222222210',
  NULL,
  'Household member',
  'published',
  'global',
  'supporting',
  '{"schemaVersion":4,"modelIdentity":"You are interviewing someone who lives in the home about the disrepair they have seen.","phases":[{"id":"whoTheyAre","title":"Who they are","objective":"Their relationship to the tenant and that they live there.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Relationship to the tenant","That they live there"],"questioningMode":"structured"},{"id":"whatTheyHaveSeen","title":"What they have seen","objective":"The disrepair they have seen in the home.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["What they have seen","How long they have seen it"],"questioningMode":"narrative"}],"sections":[{"id":"introduction","title":"Introduction","description":"Who the household member is."},{"id":"whatTheyHaveSeen","title":"What I have seen","description":"The disrepair they describe."}],"witnessMetadataFields":[{"id":"address","label":"Address","description":"The witness residential address.","requiredOnIntake":true,"requiredOnCreate":false},{"id":"occupation","label":"Occupation","description":"The witness occupation.","requiredOnIntake":false,"requiredOnCreate":false}],"caseMetadataDeps":["claimant","defendant","disrepairDate","property"]}'::jsonb,
  '{"schemaVersion":4,"modelIdentity":"You are interviewing someone who lives in the home about the disrepair they have seen.","phases":[{"id":"whoTheyAre","title":"Who they are","objective":"Their relationship to the tenant and that they live there.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["Relationship to the tenant","That they live there"],"questioningMode":"structured"},{"id":"whatTheyHaveSeen","title":"What they have seen","objective":"The disrepair they have seen in the home.","allowedTopics":null,"forbiddenTopics":null,"completionCriteria":["What they have seen","How long they have seen it"],"questioningMode":"narrative"}],"sections":[{"id":"introduction","title":"Introduction","description":"Who the household member is."},{"id":"whatTheyHaveSeen","title":"What I have seen","description":"The disrepair they describe."}],"witnessMetadataFields":[{"id":"address","label":"Address","description":"The witness residential address.","requiredOnIntake":true,"requiredOnCreate":false},{"id":"occupation","label":"Occupation","description":"The witness occupation.","requiredOnIntake":false,"requiredOnCreate":false}],"caseMetadataDeps":["claimant","defendant","disrepairDate","property"]}'::jsonb,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.statement_config_templates WHERE id = '22222222-2222-4222-8222-222222222210'
);

CREATE TABLE IF NOT EXISTS public.statement_template_links (
  primary_template_id uuid NOT NULL REFERENCES public.statement_config_templates(id) ON DELETE CASCADE,
  supporting_template_id uuid NOT NULL REFERENCES public.statement_config_templates(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (primary_template_id, role_key)
);

INSERT INTO public.statement_template_links (
  primary_template_id, supporting_template_id, role_key, label
)
SELECT
  primary_link.statement_template_id,
  supporting_link.statement_template_id,
  'witness',
  'Witness'
FROM public.case_template_statement_templates AS supporting_link
JOIN public.case_template_statement_templates AS primary_link
  ON primary_link.case_template_id = supporting_link.case_template_id
 AND primary_link.is_default = true
WHERE supporting_link.is_default = false
ON CONFLICT (primary_template_id, role_key) DO NOTHING;

INSERT INTO public.statement_template_links (
  primary_template_id, supporting_template_id, role_key, label
)
SELECT
  '22222222-2222-4222-8222-222222222209',
  '22222222-2222-4222-8222-222222222210',
  'household',
  'Household member'
WHERE EXISTS (
  SELECT 1
  FROM public.statement_config_templates
  WHERE id = '22222222-2222-4222-8222-222222222209'
)
ON CONFLICT (primary_template_id, role_key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS statement_config_templates_public_slug_key
  ON public.statement_config_templates (public_slug)
  WHERE public_slug IS NOT NULL;

-- Remove existing files, chats, and channels. Tenants and users stay.
DELETE FROM public.lead_sessions;
DELETE FROM public.lead_channels;
DELETE FROM public.cases;

CREATE TABLE IF NOT EXISTS public.statement_matters (
  statement_id uuid PRIMARY KEY REFERENCES public.statements(id) ON DELETE CASCADE,
  summary text,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_status text NOT NULL DEFAULT 'draft'
);

UPDATE public.case_template_tenant_preferences
SET default_case_template_id = NULL
WHERE default_case_template_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.cases;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'case_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.case_templates;
  END IF;
END $$;

DROP TABLE IF EXISTS public.case_config_snapshots CASCADE;
DROP TABLE IF EXISTS public.case_template_statement_templates CASCADE;
DROP TABLE IF EXISTS public.cases CASCADE;
DROP TABLE IF EXISTS public.case_templates CASCADE;

ALTER TABLE public.statements
  DROP CONSTRAINT IF EXISTS statements_case_id_fkey;
ALTER TABLE public.statements
  ADD CONSTRAINT statements_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.statements(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF to_regclass('public.case_notes') IS NOT NULL THEN
    ALTER TABLE public.case_notes DROP CONSTRAINT IF EXISTS case_notes_case_id_fkey;
    ALTER TABLE public.case_notes
      ADD CONSTRAINT case_notes_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.statements(id) ON DELETE CASCADE;
  END IF;
  IF to_regclass('public.case_documents') IS NOT NULL THEN
    ALTER TABLE public.case_documents DROP CONSTRAINT IF EXISTS case_documents_case_id_fkey;
    ALTER TABLE public.case_documents
      ADD CONSTRAINT case_documents_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.statements(id) ON DELETE CASCADE;
  END IF;
  IF to_regclass('public.case_analysis_snapshots') IS NOT NULL THEN
    ALTER TABLE public.case_analysis_snapshots DROP CONSTRAINT IF EXISTS case_analysis_snapshots_case_id_fkey;
    ALTER TABLE public.case_analysis_snapshots
      ADD CONSTRAINT case_analysis_snapshots_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.statements(id) ON DELETE CASCADE;
  END IF;
  IF to_regclass('public.statement_supporting_documents') IS NOT NULL THEN
    ALTER TABLE public.statement_supporting_documents DROP CONSTRAINT IF EXISTS statement_supporting_documents_case_id_fkey;
    ALTER TABLE public.statement_supporting_documents
      ADD CONSTRAINT statement_supporting_documents_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.statements(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.statements DROP CONSTRAINT IF EXISTS statements_lead_type_id_fkey;
ALTER TABLE public.statements
  ADD CONSTRAINT statements_lead_type_id_fkey
  FOREIGN KEY (lead_type_id) REFERENCES public.statement_config_templates(id) ON DELETE SET NULL;

ALTER TABLE public.lead_channels DROP CONSTRAINT IF EXISTS lead_channels_lead_type_id_fkey;
ALTER TABLE public.lead_channels
  ADD CONSTRAINT lead_channels_lead_type_id_fkey
  FOREIGN KEY (lead_type_id) REFERENCES public.statement_config_templates(id) ON DELETE CASCADE;

ALTER TABLE public.lead_sessions DROP CONSTRAINT IF EXISTS lead_sessions_lead_type_id_fkey;
ALTER TABLE public.lead_sessions
  ADD CONSTRAINT lead_sessions_lead_type_id_fkey
  FOREIGN KEY (lead_type_id) REFERENCES public.statement_config_templates(id) ON DELETE CASCADE;

ALTER TABLE public.case_template_tenant_preferences
  DROP CONSTRAINT IF EXISTS case_template_tenant_preferences_default_case_template_id_fkey;
ALTER TABLE public.case_template_tenant_preferences
  ADD CONSTRAINT case_template_tenant_preferences_default_case_template_id_fkey
  FOREIGN KEY (default_case_template_id) REFERENCES public.statement_config_templates(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW public.cases
WITH (security_invoker = true) AS
SELECT
  statement.id,
  statement.tenant_id,
  statement.title,
  COALESCE(matter.file_status, 'draft') AS status,
  statement.assigned_to,
  statement.assigned_to_ids,
  statement.created_at,
  statement.updated_at,
  statement.lead_type_id AS case_template_id,
  statement.config_snapshot_id,
  COALESCE(matter.facts, '{}'::jsonb) AS case_metadata
FROM public.statements AS statement
LEFT JOIN public.statement_matters AS matter
  ON matter.statement_id = statement.id
WHERE statement.participant_kind = 'primary';

CREATE OR REPLACE FUNCTION public.cases_view_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matter_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    matter_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO public.statements (
      id, case_id, tenant_id, title, witness_name, witness_email,
      participant_kind, role_key, lead_type_id, lead_stage, status,
      assigned_to, assigned_to_ids
    ) VALUES (
      matter_id,
      matter_id,
      NEW.tenant_id,
      NEW.title,
      'pending',
      'pending',
      'primary',
      'claimant',
      NEW.case_template_id,
      'new',
      'draft',
      NEW.assigned_to,
      COALESCE(NEW.assigned_to_ids, '{}'::uuid[])
    );
    INSERT INTO public.statement_matters (statement_id, summary, facts, file_status)
    VALUES (
      matter_id,
      NULLIF(NEW.case_metadata->>'summary', ''),
      COALESCE(NEW.case_metadata, '{}'::jsonb),
      COALESCE(NEW.status, 'draft')
    );
    NEW.id := matter_id;
    NEW.status := COALESCE(NEW.status, 'draft');
    NEW.case_metadata := COALESCE(NEW.case_metadata, '{}'::jsonb);
    NEW.assigned_to_ids := COALESCE(NEW.assigned_to_ids, '{}'::uuid[]);
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.statements
    SET
      title = NEW.title,
      assigned_to = NEW.assigned_to,
      assigned_to_ids = COALESCE(NEW.assigned_to_ids, '{}'::uuid[]),
      lead_type_id = NEW.case_template_id,
      config_snapshot_id = NEW.config_snapshot_id,
      updated_at = now()
    WHERE id = OLD.id;
    INSERT INTO public.statement_matters (statement_id, summary, facts, file_status)
    VALUES (
      OLD.id,
      NULLIF(NEW.case_metadata->>'summary', ''),
      COALESCE(NEW.case_metadata, '{}'::jsonb),
      COALESCE(NEW.status, 'draft')
    )
    ON CONFLICT (statement_id) DO UPDATE
    SET
      summary = EXCLUDED.summary,
      facts = EXCLUDED.facts,
      file_status = EXCLUDED.file_status;
    RETURN NEW;
  END IF;

  DELETE FROM public.statements WHERE parent_statement_id = OLD.id;
  DELETE FROM public.statements WHERE case_id = OLD.id AND id <> OLD.id;
  DELETE FROM public.statements WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cases_view_write ON public.cases;
CREATE TRIGGER cases_view_write
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.cases_view_write();

CREATE OR REPLACE VIEW public.case_templates
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  created_at,
  created_by,
  updated_at,
  published_at,
  COALESCE(matter_config, '{}'::jsonb) AS draft_config,
  matter_config AS published_config,
  source_template_id,
  status,
  template_scope,
  tenant_id,
  branding,
  decline_reasons,
  outreach_template,
  participant_roles,
  public_slug,
  qualification_slots,
  COALESCE(title_template, 'Case {caseIndex}') AS title_template
FROM public.statement_config_templates
WHERE kind = 'primary';

CREATE OR REPLACE FUNCTION public.case_templates_view_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_id uuid;
  interview jsonb := '{"schemaVersion":4,"phases":[],"sections":[],"witnessMetadataFields":[],"caseMetadataDeps":[]}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    template_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO public.statement_config_templates (
      id, name, kind, template_scope, tenant_id, status, created_by,
      title_template, public_slug, outreach_template, decline_reasons,
      qualification_slots, participant_roles, branding, matter_config,
      draft_config, published_config, published_at
    ) VALUES (
      template_id,
      NEW.name,
      'primary',
      NEW.template_scope,
      NEW.tenant_id,
      COALESCE(NEW.status, 'draft'),
      NEW.created_by,
      COALESCE(NEW.title_template, 'Case {caseIndex}'),
      NEW.public_slug,
      NEW.outreach_template,
      COALESCE(NEW.decline_reasons, '[]'::jsonb),
      COALESCE(NEW.qualification_slots, '[]'::jsonb),
      COALESCE(NEW.participant_roles, '[]'::jsonb),
      COALESCE(NEW.branding, '{}'::jsonb),
      COALESCE(NEW.published_config, NEW.draft_config, '{}'::jsonb),
      interview,
      interview,
      CASE WHEN COALESCE(NEW.status, 'draft') = 'published' THEN now() ELSE NULL END
    );
    NEW.id := template_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE public.statement_config_templates
    SET
      name = NEW.name,
      status = COALESCE(NEW.status, status),
      template_scope = COALESCE(NEW.template_scope, template_scope),
      tenant_id = NEW.tenant_id,
      title_template = NEW.title_template,
      public_slug = NEW.public_slug,
      outreach_template = NEW.outreach_template,
      decline_reasons = COALESCE(NEW.decline_reasons, '[]'::jsonb),
      qualification_slots = COALESCE(NEW.qualification_slots, '[]'::jsonb),
      participant_roles = COALESCE(NEW.participant_roles, '[]'::jsonb),
      branding = COALESCE(NEW.branding, '{}'::jsonb),
      matter_config = COALESCE(NEW.published_config, matter_config),
      updated_at = now()
    WHERE id = OLD.id;
    RETURN NEW;
  END IF;

  DELETE FROM public.statement_config_templates WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS case_templates_view_write ON public.case_templates;
CREATE TRIGGER case_templates_view_write
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.case_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.case_templates_view_write();

CREATE OR REPLACE VIEW public.case_template_statement_templates
WITH (security_invoker = true) AS
SELECT
  id AS case_template_id,
  id AS statement_template_id,
  true AS is_default
FROM public.statement_config_templates
WHERE kind = 'primary'
UNION ALL
SELECT
  primary_template_id AS case_template_id,
  supporting_template_id AS statement_template_id,
  false AS is_default
FROM public.statement_template_links;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_templates TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.case_template_links_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_default, false) OR NEW.case_template_id = NEW.statement_template_id THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.statement_template_links (
      primary_template_id, supporting_template_id, role_key, label
    ) VALUES (
      NEW.case_template_id,
      NEW.statement_template_id,
      NEW.statement_template_id::text,
      'Witness'
    )
    ON CONFLICT (primary_template_id, role_key) DO NOTHING;
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.is_default, false) OR OLD.case_template_id = OLD.statement_template_id THEN
    RETURN OLD;
  END IF;
  DELETE FROM public.statement_template_links
  WHERE primary_template_id = OLD.case_template_id
    AND supporting_template_id = OLD.statement_template_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS case_template_links_write ON public.case_template_statement_templates;
CREATE TRIGGER case_template_links_write
  INSTEAD OF INSERT OR DELETE ON public.case_template_statement_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.case_template_links_write();

GRANT SELECT, INSERT, DELETE ON public.case_template_statement_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statement_matters TO service_role;
GRANT SELECT ON public.statement_matters TO authenticated;

ALTER TABLE public.statement_matters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant members read statement matters" ON public.statement_matters;
CREATE POLICY "Tenant members read statement matters"
  ON public.statement_matters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.statements AS statement
      WHERE statement.id = statement_id
        AND statement.tenant_id = public.user_tenant_id()
        AND public.is_tenant_active(statement.tenant_id)
    )
    OR public.user_role() = 'app_admin'
  );

INSERT INTO public.lead_channels (tenant_id, lead_type_id, public_key, enabled)
SELECT tenants.id, templates.id, encode(gen_random_bytes(24), 'hex'), true
FROM public.tenants
JOIN public.statement_config_templates AS templates
  ON templates.public_slug IN (
    'rta',
    'clinical-negligence',
    'public-liability',
    'employer-liability',
    'housing-disrepair'
  )
 AND templates.kind = 'primary'
WHERE lower(tenants.public_slug) = 'demo'
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_channels
    WHERE lead_channels.tenant_id = tenants.id
      AND lead_channels.lead_type_id = templates.id
  );
