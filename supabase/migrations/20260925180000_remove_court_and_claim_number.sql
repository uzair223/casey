-- Court and claim number are not known while a lead is being taken.

CREATE OR REPLACE FUNCTION public.strip_court_and_claim_number(config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  next_config jsonb := config;
  fields jsonb;
  deps jsonb;
BEGIN
  IF next_config IS NULL OR jsonb_typeof(next_config) <> 'object' THEN
    RETURN next_config;
  END IF;

  IF jsonb_typeof(next_config->'dynamicFields') = 'array' THEN
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO fields
    FROM jsonb_array_elements(next_config->'dynamicFields') AS item
    WHERE COALESCE(item->>'id', '') NOT IN ('court', 'claimNumber');
    next_config := jsonb_set(next_config, '{dynamicFields}', fields);
  END IF;

  IF jsonb_typeof(next_config->'caseMetadataDeps') = 'array' THEN
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO deps
    FROM jsonb_array_elements(next_config->'caseMetadataDeps') AS item
    WHERE trim(both '"' from item::text) NOT IN ('court', 'claimNumber');
    next_config := jsonb_set(next_config, '{caseMetadataDeps}', deps);
  END IF;

  RETURN next_config;
END;
$$;

UPDATE public.case_templates
SET
  draft_config = public.strip_court_and_claim_number(draft_config),
  published_config = public.strip_court_and_claim_number(published_config)
WHERE draft_config IS NOT NULL OR published_config IS NOT NULL;

UPDATE public.case_config_snapshots
SET config_json = public.strip_court_and_claim_number(config_json)
WHERE config_json IS NOT NULL;

UPDATE public.statement_config_templates
SET
  draft_config = public.strip_court_and_claim_number(draft_config),
  published_config = public.strip_court_and_claim_number(published_config)
WHERE draft_config IS NOT NULL OR published_config IS NOT NULL;

UPDATE public.statement_config_snapshots
SET config_json = public.strip_court_and_claim_number(config_json)
WHERE config_json IS NOT NULL;

DROP FUNCTION public.strip_court_and_claim_number(jsonb);
