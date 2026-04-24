-- Prevent tenant deletions from failing due to audit_logs tenant FK violations.
-- 1) Ensure audit_logs.tenant_id uses ON DELETE SET NULL.
-- 2) Ensure row-level audit trigger never inserts a tenant_id that no longer exists.

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_tenant_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.write_row_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_data jsonb;
  previous_data jsonb;
  target_id text;
  resolved_tenant_id uuid;
  field_changes jsonb;
  changed_key text;
  old_value jsonb;
  new_value jsonb;
  summary_parts text[];
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
    row_data ->> 'case_id',
    row_data ->> 'statement_id',
    row_data ->> 'requested_user_id',
    row_data ->> 'tenant_id'
  );

  resolved_tenant_id := CASE
    WHEN COALESCE(row_data ->> 'tenant_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (row_data ->> 'tenant_id')::uuid
    WHEN TG_TABLE_NAME = 'tenants'
      AND COALESCE(row_data ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (row_data ->> 'id')::uuid
    ELSE NULL
  END;

  -- If the tenant was deleted (or otherwise does not exist), avoid FK violations.
  IF resolved_tenant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.tenants t WHERE t.id = resolved_tenant_id
     ) THEN
    resolved_tenant_id := NULL;
  END IF;

  -- Build field-level changes for UPDATE operations
  field_changes := '[]'::jsonb;
  summary_parts := ARRAY[]::text[];

  IF TG_OP = 'UPDATE' THEN
    FOR changed_key IN SELECT jsonb_object_keys(row_data) LOOP
      IF changed_key = 'updated_at' THEN
        CONTINUE;
      END IF;

      old_value := previous_data -> changed_key;
      new_value := row_data -> changed_key;

      IF old_value IS DISTINCT FROM new_value THEN
        field_changes := field_changes || jsonb_build_object(
          'field', changed_key,
          'old', old_value,
          'new', new_value
        );
        summary_parts := array_append(
          summary_parts,
          format(
            '%s: %s → %s',
            changed_key,
            COALESCE(old_value::text, 'NULL'),
            COALESCE(new_value::text, 'NULL')
          )
        );
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    resolved_tenant_id,
    auth.uid(),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    target_id,
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'new', row_data,
      'old', previous_data,
      'field_changes', field_changes,
      'message', CASE
        WHEN TG_OP = 'INSERT' THEN format('Created new %s record', TG_TABLE_NAME)
        WHEN TG_OP = 'DELETE' THEN format('Deleted %s record', TG_TABLE_NAME)
        WHEN TG_OP = 'UPDATE' THEN CASE
          WHEN array_length(summary_parts, 1) > 0
            THEN format('Updated fields: %s', array_to_string(summary_parts, '; '))
          ELSE format('Updated %s record', TG_TABLE_NAME)
        END
        ELSE 'Unknown operation'
      END
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
