-- Trial firms may add three witnesses on a case, and may not create templates.
-- The triggers run for every insert, including a direct browser write.

CREATE OR REPLACE FUNCTION public.enforce_trial_witness_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_plan text;
  witness_count integer;
BEGIN
  SELECT plan INTO tenant_plan
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF tenant_plan IS DISTINCT FROM 'trial' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO witness_count
  FROM public.statements
  WHERE case_id = NEW.case_id;

  IF witness_count >= 3 THEN
    RAISE EXCEPTION 'trial_witness_cap'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS statements_trial_witness_cap ON public.statements;
CREATE TRIGGER statements_trial_witness_cap
  BEFORE INSERT ON public.statements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trial_witness_cap();

CREATE OR REPLACE FUNCTION public.enforce_trial_template_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tenant_plan text;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO tenant_plan
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  IF tenant_plan = 'trial' THEN
    RAISE EXCEPTION 'trial_template_cap'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS case_templates_trial_cap ON public.case_templates;
CREATE TRIGGER case_templates_trial_cap
  BEFORE INSERT ON public.case_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trial_template_cap();

DROP TRIGGER IF EXISTS statement_templates_trial_cap ON public.statement_config_templates;
CREATE TRIGGER statement_templates_trial_cap
  BEFORE INSERT ON public.statement_config_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trial_template_cap();
