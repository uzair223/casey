drop policy "Authenticated users can delete cases" on "public"."cases";

drop policy "Authenticated users can update cases" on "public"."cases";

drop policy "Authenticated users can view cases" on "public"."cases";

drop policy "Authenticated users can read conversation messages" on "public"."conversation_messages";

drop policy "Authenticated users can delete witness statements" on "public"."statements";

drop policy "Authenticated users can update witness statements" on "public"."statements";

drop policy "Authenticated users can view witness statements" on "public"."statements";

alter table "public"."audit_logs" drop constraint "audit_logs_tenant_id_fkey";

drop function if exists "public"."run_tenant_cleanup_job"();

alter table "public"."audit_logs" add constraint "audit_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_tenant_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_tenant_storage_bucket_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  tenant_bucket_id TEXT;
BEGIN
  tenant_bucket_id := OLD.id::text;

  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = tenant_bucket_id;

    DELETE FROM storage.buckets
    WHERE id = tenant_bucket_id;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      -- Newer Supabase storage protections may require Storage API usage.
      -- Skip DB-table cleanup so tenant delete can still succeed.
      NULL;
  END;

  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.write_row_audit_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  nested_key text;
  nested_old jsonb;
  nested_new jsonb;
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

        -- Both sides are objects: diff at the nested key level
        IF jsonb_typeof(old_value) = 'object' AND jsonb_typeof(new_value) = 'object' THEN
          FOR nested_key IN
            SELECT DISTINCT k FROM (
              SELECT jsonb_object_keys(old_value) AS k
              UNION
              SELECT jsonb_object_keys(new_value) AS k
            ) keys
          LOOP
            nested_old := old_value -> nested_key;
            nested_new := new_value -> nested_key;

            IF nested_old IS DISTINCT FROM nested_new THEN
              field_changes := field_changes || jsonb_build_object(
                'field', changed_key || '.' || nested_key,
                'old',   nested_old,
                'new',   nested_new
              );
              summary_parts := array_append(
                summary_parts,
                format('%s: %s → %s',
                  changed_key || '.' || nested_key,
                  COALESCE(nested_old::text, 'NULL'),
                  COALESCE(nested_new::text, 'NULL')
                )
              );
            END IF;
          END LOOP;

        -- Scalar or array: record as-is
        ELSE
          field_changes := field_changes || jsonb_build_object(
            'field', changed_key,
            'old',   old_value,
            'new',   new_value
          );
          summary_parts := array_append(
            summary_parts,
            format('%s: %s → %s',
              changed_key,
              COALESCE(old_value::text, 'NULL'),
              COALESCE(new_value::text, 'NULL')
            )
          );
        END IF;

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
      'operation',     TG_OP,
      'table',         TG_TABLE_NAME,
      'new',           row_data,
      'old',           previous_data,
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
$function$
;


  create policy "Authenticated users can delete cases"
  on "public"."cases"
  as permissive
  for delete
  to authenticated
using ((((tenant_id = public.user_tenant_id()) AND public.is_tenant_active(tenant_id)) OR (public.user_role() = 'app_admin'::text)));



  create policy "Authenticated users can update cases"
  on "public"."cases"
  as permissive
  for update
  to authenticated
using ((((tenant_id = public.user_tenant_id()) AND public.is_tenant_active(tenant_id)) OR (public.user_role() = 'app_admin'::text)))
with check ((((tenant_id = public.user_tenant_id()) AND public.current_tenant_is_active()) OR (public.user_role() = 'app_admin'::text)));



  create policy "Authenticated users can view cases"
  on "public"."cases"
  as permissive
  for select
  to authenticated
using ((((tenant_id = public.user_tenant_id()) AND public.is_tenant_active(tenant_id)) OR (public.user_role() = 'app_admin'::text)));



  create policy "Authenticated users can read conversation messages"
  on "public"."conversation_messages"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.statements ws
  WHERE ((ws.id = conversation_messages.statement_id) AND ((ws.tenant_id = public.user_tenant_id()) OR (public.user_role() = 'app_admin'::text))))));



  create policy "Authenticated users can delete witness statements"
  on "public"."statements"
  as permissive
  for delete
  to authenticated
using ((((tenant_id = public.user_tenant_id()) AND public.is_tenant_active(tenant_id)) OR (public.user_role() = 'app_admin'::text)));



  create policy "Authenticated users can update witness statements"
  on "public"."statements"
  as permissive
  for update
  to authenticated
using ((((tenant_id = public.user_tenant_id()) AND public.is_tenant_active(tenant_id)) OR (public.user_role() = 'app_admin'::text)))
with check ((((tenant_id = public.user_tenant_id()) AND public.current_tenant_is_active()) OR (public.user_role() = 'app_admin'::text)));



  create policy "Authenticated users can view witness statements"
  on "public"."statements"
  as permissive
  for select
  to authenticated
using ((((tenant_id = public.user_tenant_id()) AND public.is_tenant_active(tenant_id)) OR (public.user_role() = 'app_admin'::text)));


CREATE TRIGGER cleanup_tenant_storage_bucket_on_delete_trigger AFTER DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.cleanup_tenant_storage_bucket_on_delete();


