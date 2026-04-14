-- Mentions, pinning, and notification preferences
-- Date: 2026-04-14

ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.statement_notes
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.case_note_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_note_id UUID NOT NULL REFERENCES public.case_notes(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_note_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS public.statement_note_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_note_id UUID NOT NULL REFERENCES public.statement_notes(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (statement_note_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_notification_preferences (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  reminders_channel TEXT NOT NULL DEFAULT 'email'
    CHECK (reminders_channel IN ('email', 'in_app', 'both', 'off')),
  follow_up_requests_channel TEXT NOT NULL DEFAULT 'email'
    CHECK (follow_up_requests_channel IN ('email', 'in_app', 'both', 'off')),
  submissions_channel TEXT NOT NULL DEFAULT 'email'
    CHECK (submissions_channel IN ('email', 'in_app', 'both', 'off')),
  mention_channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (mention_channel IN ('email', 'in_app', 'both', 'off')),
  digest_frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (digest_frequency IN ('off', 'daily', 'weekly')),
  updated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case_pinned_created
  ON public.case_notes(case_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_notes_statement_pinned_created
  ON public.statement_notes(statement_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_note_mentions_note_created
  ON public.case_note_mentions(case_note_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_note_mentions_mentioned_user_created
  ON public.case_note_mentions(mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_note_mentions_note_created
  ON public.statement_note_mentions(statement_note_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_note_mentions_mentioned_user_created
  ON public.statement_note_mentions(mentioned_user_id, created_at DESC);

DROP TRIGGER IF EXISTS tenant_notification_preferences_updated_at ON public.tenant_notification_preferences;
CREATE TRIGGER tenant_notification_preferences_updated_at
  BEFORE UPDATE ON public.tenant_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_note_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_note_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view case note mentions"
  ON public.case_note_mentions FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert case note mentions"
  ON public.case_note_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND created_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete case note mentions"
  ON public.case_note_mentions FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can view statement note mentions"
  ON public.statement_note_mentions FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert statement note mentions"
  ON public.statement_note_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND created_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete statement note mentions"
  ON public.statement_note_mentions FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can view tenant notification preferences"
  ON public.tenant_notification_preferences FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert tenant notification preferences"
  ON public.tenant_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND updated_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can update tenant notification preferences"
  ON public.tenant_notification_preferences FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Service role can manage case note mentions"
  ON public.case_note_mentions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage statement note mentions"
  ON public.statement_note_mentions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage tenant notification preferences"
  ON public.tenant_notification_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
