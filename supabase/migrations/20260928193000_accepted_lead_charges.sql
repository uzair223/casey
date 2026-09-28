CREATE TABLE public.accepted_lead_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_id uuid REFERENCES public.statements(id) ON DELETE SET NULL,
  accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX accepted_lead_charges_statement_id_key
  ON public.accepted_lead_charges (statement_id)
  WHERE statement_id IS NOT NULL;

CREATE INDEX accepted_lead_charges_tenant_accepted_at
  ON public.accepted_lead_charges (tenant_id, accepted_at);

ALTER TABLE public.accepted_lead_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage accepted lead charges"
  ON public.accepted_lead_charges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.accepted_lead_charges (tenant_id, statement_id, accepted_at)
SELECT tenant_id, id, accepted_at
FROM public.statements
WHERE participant_kind = 'primary'
  AND accepted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_accepted_lead_charge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.participant_kind IS DISTINCT FROM 'primary' OR NEW.accepted_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.accepted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.accepted_lead_charges (tenant_id, statement_id, accepted_at)
  VALUES (NEW.tenant_id, NEW.id, NEW.accepted_at)
  ON CONFLICT (statement_id) WHERE statement_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS statements_record_accepted_lead_charge ON public.statements;
CREATE TRIGGER statements_record_accepted_lead_charge
  AFTER INSERT OR UPDATE OF accepted_at ON public.statements
  FOR EACH ROW
  EXECUTE FUNCTION public.record_accepted_lead_charge();
