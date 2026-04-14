-- Allow tenant members to rename and delete internal evidence documents
-- Date: 2026-04-14

CREATE POLICY "Authenticated users can update case documents"
  ON public.case_documents FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete case documents"
  ON public.case_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );

CREATE POLICY "Authenticated users can update statement internal documents"
  ON public.statement_internal_documents FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.user_tenant_id()
    AND public.current_tenant_is_active()
  );

CREATE POLICY "Authenticated users can delete statement internal documents"
  ON public.statement_internal_documents FOR DELETE
  TO authenticated
  USING (
    tenant_id = public.user_tenant_id()
    AND public.is_tenant_active(tenant_id)
  );