-- Firm-witness realtime chat, separate from the AI interview transcript.
-- Date: 2026-09-30

CREATE TABLE IF NOT EXISTS public.witness_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL UNIQUE REFERENCES public.statements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  realtime_key TEXT NOT NULL,
  witness_last_seen_at TIMESTAMPTZ,
  witness_last_message_at TIMESTAMPTZ,
  unread_firm_since TIMESTAMPTZ,
  notify_after TIMESTAMPTZ,
  last_outreach_at TIMESTAMPTZ,
  last_outreach_message_id UUID,
  outreach_anchor_at TIMESTAMPTZ,
  reminder_stage INTEGER NOT NULL DEFAULT 0,
  next_reminder_at TIMESTAMPTZ,
  firm_last_seen_at TIMESTAMPTZ,
  firm_unread_since TIMESTAMPTZ,
  firm_notify_after TIMESTAMPTZ,
  firm_last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_witness_threads_notify_after
  ON public.witness_threads(notify_after)
  WHERE notify_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_witness_threads_next_reminder
  ON public.witness_threads(next_reminder_at)
  WHERE next_reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_witness_threads_firm_notify
  ON public.witness_threads(firm_notify_after)
  WHERE firm_notify_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_witness_threads_tenant
  ON public.witness_threads(tenant_id);

DROP TRIGGER IF EXISTS witness_threads_updated_at ON public.witness_threads;
CREATE TRIGGER witness_threads_updated_at
  BEFORE UPDATE ON public.witness_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.witness_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.witness_threads(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('witness', 'firm')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_witness_messages_thread_created
  ON public.witness_messages(thread_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_witness_messages_client_id
  ON public.witness_messages(thread_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.witness_reads (
  thread_id UUID NOT NULL REFERENCES public.witness_threads(id) ON DELETE CASCADE,
  reader_key TEXT NOT NULL,
  reader_type TEXT NOT NULL CHECK (reader_type IN ('witness', 'firm')),
  reader_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (thread_id, reader_key)
);

CREATE TABLE IF NOT EXISTS public.witness_file_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.witness_threads(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.witness_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  reminder_24h_sent_at TIMESTAMPTZ,
  due_sent_at TIMESTAMPTZ,
  overdue_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_witness_file_requests_open_due
  ON public.witness_file_requests(due_at)
  WHERE due_at IS NOT NULL AND fulfilled_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.witness_outbound_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.witness_threads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'deadline')),
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,
  send_after TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_witness_outbound_sms_due
  ON public.witness_outbound_sms(send_after)
  WHERE sent_at IS NULL;

ALTER TABLE public.witness_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_file_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_outbound_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view witness threads"
  ON public.witness_threads FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can manage witness threads"
  ON public.witness_threads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view witness messages"
  ON public.witness_messages FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can manage witness messages"
  ON public.witness_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view witness reads"
  ON public.witness_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.witness_threads thread
      WHERE thread.id = witness_reads.thread_id
        AND thread.tenant_id = public.user_tenant_id()
        AND public.is_tenant_active(thread.tenant_id)
    )
  );

CREATE POLICY "Service role can manage witness reads"
  ON public.witness_reads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view witness file requests"
  ON public.witness_file_requests FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Service role can manage witness file requests"
  ON public.witness_file_requests FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage witness outbound sms"
  ON public.witness_outbound_sms FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS audit_witness_threads ON public.witness_threads;
CREATE TRIGGER audit_witness_threads
  AFTER INSERT OR UPDATE OR DELETE ON public.witness_threads
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_witness_messages ON public.witness_messages;
CREATE TRIGGER audit_witness_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.witness_messages
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_witness_reads ON public.witness_reads;
CREATE TRIGGER audit_witness_reads
  AFTER INSERT OR UPDATE OR DELETE ON public.witness_reads
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_witness_file_requests ON public.witness_file_requests;
CREATE TRIGGER audit_witness_file_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.witness_file_requests
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_witness_outbound_sms ON public.witness_outbound_sms;
CREATE TRIGGER audit_witness_outbound_sms
  AFTER INSERT OR UPDATE OR DELETE ON public.witness_outbound_sms
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

INSERT INTO public.witness_threads (statement_id, tenant_id, realtime_key)
SELECT DISTINCT
  statement.id,
  statement.tenant_id,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
FROM public.statements statement
JOIN public.conversation_messages message
  ON message.statement_id = statement.id
WHERE (message.meta->'followUpRequest') = 'true'::jsonb
   OR (message.meta->'followUpResponse') = 'true'::jsonb
ON CONFLICT (statement_id) DO NOTHING;

INSERT INTO public.witness_messages (
  thread_id,
  statement_id,
  tenant_id,
  sender_type,
  sender_name,
  body,
  attachments,
  created_at
)
SELECT
  thread.id,
  message.statement_id,
  thread.tenant_id,
  CASE WHEN message.role = 'user' THEN 'witness' ELSE 'firm' END,
  CASE
    WHEN message.role = 'user' THEN COALESCE(NULLIF(statement.witness_name, ''), 'Witness')
    ELSE COALESCE(NULLIF(message.meta->>'requestedBy', ''), 'Legal team')
  END,
  message.content,
  CASE
    WHEN jsonb_typeof(message.meta->'uploadedDocuments') = 'array' THEN message.meta->'uploadedDocuments'
    WHEN jsonb_typeof(message.meta->'attachedFiles') = 'array' THEN message.meta->'attachedFiles'
    ELSE '[]'::jsonb
  END,
  message.created_at
FROM public.conversation_messages message
JOIN public.witness_threads thread ON thread.statement_id = message.statement_id
JOIN public.statements statement ON statement.id = message.statement_id
WHERE (message.meta->'followUpRequest') = 'true'::jsonb
   OR (message.meta->'followUpResponse') = 'true'::jsonb;

INSERT INTO public.witness_reads (thread_id, reader_key, reader_type, last_read_at)
SELECT thread.id, 'witness', 'witness', latest.created_at
FROM public.witness_threads thread
JOIN LATERAL (
  SELECT created_at, sender_type
  FROM public.witness_messages message
  WHERE message.thread_id = thread.id
  ORDER BY created_at DESC
  LIMIT 1
) latest ON true
WHERE latest.sender_type = 'witness'
ON CONFLICT (thread_id, reader_key) DO NOTHING;
