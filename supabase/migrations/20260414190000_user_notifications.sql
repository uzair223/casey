-- In-app notifications for note mentions
-- Date: 2026-04-14

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('case_note_mention', 'statement_note_mention')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('case_note', 'statement_note')),
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link_path TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, recipient_user_id, notification_type, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created
  ON public.user_notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
  ON public.user_notifications(recipient_user_id, read_at, created_at DESC);

DROP TRIGGER IF EXISTS user_notifications_updated_at ON public.user_notifications;
CREATE TRIGGER user_notifications_updated_at
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their notifications"
  ON public.user_notifications FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can update their notifications"
  ON public.user_notifications FOR UPDATE
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    AND tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can manage notifications"
  ON public.user_notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

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
  note_source_id UUID;
  note_entity_type TEXT;
  note_notification_type TEXT;
  note_link_path TEXT;
  note_title TEXT;
  actor_display_name TEXT;
  notification_channel TEXT;
  tenant_name TEXT;
  excerpt TEXT;
BEGIN
  IF TG_TABLE_NAME = 'case_note_mentions' THEN
    SELECT cn.tenant_id, cn.body, cn.author_user_id, cn.case_id
      INTO note_tenant_id, note_body, note_author_user_id, note_case_id
    FROM public.case_notes cn
    WHERE cn.id = NEW.case_note_id;

    note_entity_type := 'case_note';
    note_notification_type := 'case_note_mention';
    note_source_id := NEW.case_note_id;
    note_link_path := '/cases/' || note_case_id::text;

  ELSIF TG_TABLE_NAME = 'statement_note_mentions' THEN
    SELECT sn.tenant_id, sn.body, sn.author_user_id, sn.statement_id
      INTO note_tenant_id, note_body, note_author_user_id, note_statement_id
    FROM public.statement_notes sn
    WHERE sn.id = NEW.statement_note_id;

    SELECT s.case_id
      INTO note_case_id
    FROM public.statements s
    WHERE s.id = note_statement_id;

    note_entity_type := 'statement_note';
    note_notification_type := 'statement_note_mention';
    note_source_id := NEW.statement_note_id;
    note_link_path := '/cases/' || note_case_id::text || '?statement=' || note_statement_id::text;
  ELSE
    RETURN NEW;
  END IF;

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

  note_title := CASE
    WHEN note_entity_type = 'case_note' THEN 'Mention in case note'
    ELSE 'Mention in statement note'
  END;

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
    note_notification_type,
    note_entity_type,
    note_source_id,
    note_title,
    CASE
      WHEN excerpt = '' THEN actor_display_name || ' mentioned you in a note.'
      ELSE actor_display_name || ' mentioned you in a note: "' || excerpt || '".'
    END,
    note_link_path,
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

DROP TRIGGER IF EXISTS case_note_mentions_create_notification ON public.case_note_mentions;
CREATE TRIGGER case_note_mentions_create_notification
  AFTER INSERT ON public.case_note_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_for_note_mention();

DROP TRIGGER IF EXISTS statement_note_mentions_create_notification ON public.statement_note_mentions;
CREATE TRIGGER statement_note_mentions_create_notification
  AFTER INSERT ON public.statement_note_mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_for_note_mention();