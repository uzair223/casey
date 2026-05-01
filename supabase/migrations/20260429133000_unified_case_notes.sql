-- Unified case notes with optional statement references.
-- Existing note tables are empty in this environment; no data backfill required.

ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES public.statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_case_notes_statement_created_at
  ON public.case_notes(statement_id, created_at DESC)
  WHERE statement_id IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated users can insert case notes" ON public.case_notes;
CREATE POLICY "Authenticated users can insert case notes"
  ON public.case_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND author_user_id = auth.uid()
    AND public.current_tenant_is_active()
    AND (
      statement_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.statements s
        WHERE s.id = statement_id
          AND s.case_id = case_id
          AND s.tenant_id = tenant_id
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update case notes" ON public.case_notes;
CREATE POLICY "Authenticated users can update case notes"
  ON public.case_notes FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
    AND (
      statement_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.statements s
        WHERE s.id = statement_id
          AND s.case_id = case_id
          AND s.tenant_id = tenant_id
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_notification_for_note_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  note_tenant_id UUID;
  note_body TEXT;
  note_author_user_id UUID;
  note_case_id UUID;
  note_statement_id UUID;
  actor_display_name TEXT;
  notification_channel TEXT;
  tenant_name TEXT;
  excerpt TEXT;
BEGIN
  SELECT cn.tenant_id, cn.body, cn.author_user_id, cn.case_id, cn.statement_id
    INTO note_tenant_id, note_body, note_author_user_id, note_case_id, note_statement_id
  FROM public.case_notes cn
  WHERE cn.id = NEW.case_note_id;

  IF note_tenant_id IS NULL OR note_body IS NULL OR note_author_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.display_name, p.user_id::text)
    INTO actor_display_name
  FROM public.profiles p
  WHERE p.user_id = note_author_user_id
  LIMIT 1;

  actor_display_name := COALESCE(actor_display_name, 'A team member');

  SELECT t.name
    INTO tenant_name
  FROM public.tenants t
  WHERE t.id = note_tenant_id;

  tenant_name := COALESCE(tenant_name, 'your tenant');

  SELECT mention_channel
    INTO notification_channel
  FROM public.tenant_notification_preferences
  WHERE tenant_id = note_tenant_id;

  IF COALESCE(notification_channel, 'in_app') NOT IN ('in_app', 'both') THEN
    RETURN NEW;
  END IF;

  excerpt := regexp_replace(COALESCE(note_body, ''), '\\s+', ' ', 'g');
  excerpt := left(excerpt, 160);

  INSERT INTO public.user_notifications (
    tenant_id,
    recipient_user_id,
    actor_user_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body,
    link_path,
    metadata
  )
  VALUES (
    note_tenant_id,
    NEW.mentioned_user_id,
    note_author_user_id,
    CASE WHEN note_statement_id IS NULL THEN 'case_note_mention' ELSE 'statement_note_mention' END,
    CASE WHEN note_statement_id IS NULL THEN 'case_note' ELSE 'statement_note' END,
    NEW.case_note_id,
    CASE WHEN note_statement_id IS NULL THEN 'Mention in case note' ELSE 'Mention in statement note' END,
    CASE
      WHEN excerpt = '' THEN actor_display_name || ' mentioned you in a note.'
      ELSE actor_display_name || ' mentioned you in a note: "' || excerpt || '".'
    END,
    CASE
      WHEN note_statement_id IS NULL THEN '/cases/' || note_case_id::text
      ELSE '/cases/' || note_case_id::text || '?statement=' || note_statement_id::text
    END,
    jsonb_build_object(
      'tenantName', tenant_name,
      'actorDisplayName', actor_display_name,
      'noteExcerpt', excerpt
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS statement_note_mentions_create_notification ON public.statement_note_mentions;
DROP TABLE IF EXISTS public.statement_note_mentions;

DROP TRIGGER IF EXISTS statement_notes_updated_at ON public.statement_notes;
DROP TABLE IF EXISTS public.statement_notes;
