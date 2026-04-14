-- Post-submission collaboration foundations
-- Date: 2026-04-14

CREATE TABLE IF NOT EXISTS public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.statement_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.statement_internal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.statement_reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cadence_days INTEGER NOT NULL DEFAULT 3 CHECK (cadence_days >= 1),
  max_reminders INTEGER CHECK (max_reminders IS NULL OR max_reminders >= 1),
  reminders_sent_count INTEGER NOT NULL DEFAULT 0 CHECK (reminders_sent_count >= 0),
  last_sent_at TIMESTAMPTZ,
  next_send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (statement_id)
);

CREATE TABLE IF NOT EXISTS public.statement_reminder_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  reminder_rule_id UUID REFERENCES public.statement_reminder_rules(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  send_type TEXT NOT NULL CHECK (send_type IN ('scheduled', 'manual', 'follow_up_request')),
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_notes_case_created_at
  ON public.case_notes(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_notes_tenant_created_at
  ON public.case_notes(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_notes_statement_created_at
  ON public.statement_notes(statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_statement_notes_tenant_created_at
  ON public.statement_notes(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_documents_case_created_at
  ON public.case_documents(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_statement_internal_documents_statement_created_at
  ON public.statement_internal_documents(statement_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_statement_reminder_rules_tenant_next_send
  ON public.statement_reminder_rules(tenant_id, is_enabled, next_send_at);
CREATE INDEX IF NOT EXISTS idx_statement_reminder_events_statement_created_at
  ON public.statement_reminder_events(statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_statement_reminder_events_status_created_at
  ON public.statement_reminder_events(status, created_at DESC);

DROP TRIGGER IF EXISTS case_notes_updated_at ON public.case_notes;
CREATE TRIGGER case_notes_updated_at
  BEFORE UPDATE ON public.case_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS statement_notes_updated_at ON public.statement_notes;
CREATE TRIGGER statement_notes_updated_at
  BEFORE UPDATE ON public.statement_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS statement_reminder_rules_updated_at ON public.statement_reminder_rules;
CREATE TRIGGER statement_reminder_rules_updated_at
  BEFORE UPDATE ON public.statement_reminder_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_internal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_reminder_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view case notes"
  ON public.case_notes FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert case notes"
  ON public.case_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND author_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

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
  );

CREATE POLICY "Authenticated users can delete case notes"
  ON public.case_notes FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can view statement notes"
  ON public.statement_notes FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert statement notes"
  ON public.statement_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND author_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can update statement notes"
  ON public.statement_notes FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete statement notes"
  ON public.statement_notes FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can view case documents"
  ON public.case_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert case documents"
  ON public.case_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND uploaded_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can view statement internal documents"
  ON public.statement_internal_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert statement internal documents"
  ON public.statement_internal_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND uploaded_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can view reminder rules"
  ON public.statement_reminder_rules FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert reminder rules"
  ON public.statement_reminder_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND created_by_user_id = auth.uid()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can update reminder rules"
  ON public.statement_reminder_rules FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can view reminder events"
  ON public.statement_reminder_events FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can insert reminder events"
  ON public.statement_reminder_events FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Service role can read case notes"
  ON public.case_notes FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage case notes"
  ON public.case_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read statement notes"
  ON public.statement_notes FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage statement notes"
  ON public.statement_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage case documents"
  ON public.case_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage statement internal documents"
  ON public.statement_internal_documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage reminder rules"
  ON public.statement_reminder_rules FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage reminder events"
  ON public.statement_reminder_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
