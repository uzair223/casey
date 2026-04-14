-- Row-level audit logging for the primary application write tables.

CREATE OR REPLACE FUNCTION public.write_row_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_data jsonb;
  previous_data jsonb;
  target_id text;
  tenant_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
    previous_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
    previous_data := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  END IF;

  target_id := COALESCE(
    row_data ->> 'id',
    row_data ->> 'user_id',
    row_data ->> 'tenant_id',
    row_data ->> 'requested_user_id',
    row_data ->> 'statement_id'
  );

  tenant_id := NULLIF(row_data ->> 'tenant_id', '')::uuid;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    tenant_id,
    auth.uid(),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    target_id,
    jsonb_build_object(
      'new', row_data,
      'old', previous_data
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_tenants ON public.tenants;
CREATE TRIGGER audit_tenants
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_invites ON public.invites;
CREATE TRIGGER audit_invites
  AFTER INSERT OR UPDATE OR DELETE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_account_deletion_requests ON public.account_deletion_requests;
CREATE TRIGGER audit_account_deletion_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_waitlist_signups ON public.waitlist_signups;
CREATE TRIGGER audit_waitlist_signups
  AFTER INSERT OR UPDATE OR DELETE ON public.waitlist_signups
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_cases ON public.cases;
CREATE TRIGGER audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_statements ON public.statements;
CREATE TRIGGER audit_statements
  AFTER INSERT OR UPDATE OR DELETE ON public.statements
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_conversation_messages ON public.conversation_messages;
CREATE TRIGGER audit_conversation_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();

DROP TRIGGER IF EXISTS audit_magic_links ON public.magic_links;
CREATE TRIGGER audit_magic_links
  AFTER INSERT OR UPDATE OR DELETE ON public.magic_links
  FOR EACH ROW EXECUTE FUNCTION public.write_row_audit_event();