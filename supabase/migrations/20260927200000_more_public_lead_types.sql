-- Road traffic, public liability, and housing disrepair become public lead types.

UPDATE public.case_templates
SET
  public_slug = 'road-traffic-collision',
  outreach_template = 'Hi, you were named as a {role} for {firm} regarding {summary}. We are kindly requesting your account.',
  qualification_slots = '[
    {"id":"name","label":"Your name","type":"text","required":true,"reserved":"name"},
    {"id":"email","label":"Email","type":"text","required":false,"reserved":"email"},
    {"id":"phone","label":"Phone","type":"text","required":false,"reserved":"phone"},
    {"id":"what","label":"What happened","type":"long_text","required":true},
    {"id":"when","label":"When it happened","type":"date","required":true,"include_in_outreach":true},
    {"id":"harm","label":"What harm followed","type":"long_text","required":true}
  ]'::jsonb,
  participant_roles = '[
    {"key":"claimant","label":"Claimant","kind":"primary","statement_template_id":"22222222-2222-4222-8222-222222222201"},
    {"key":"witness","label":"Witness","kind":"supporting","statement_template_id":"22222222-2222-4222-8222-222222222202"}
  ]'::jsonb,
  decline_reasons = '[{"key":"no_collision","label":"No collision described"}]'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111101';

UPDATE public.case_templates
SET
  public_slug = 'public-liability',
  outreach_template = 'Hi, you were named as a {role} for {firm} regarding {summary}. We are kindly requesting your account.',
  qualification_slots = '[
    {"id":"name","label":"Your name","type":"text","required":true,"reserved":"name"},
    {"id":"email","label":"Email","type":"text","required":false,"reserved":"email"},
    {"id":"phone","label":"Phone","type":"text","required":false,"reserved":"phone"},
    {"id":"what","label":"What happened","type":"long_text","required":true},
    {"id":"when","label":"When it happened","type":"date","required":true,"include_in_outreach":true},
    {"id":"harm","label":"What harm followed","type":"long_text","required":true}
  ]'::jsonb,
  participant_roles = '[
    {"key":"claimant","label":"Injured person","kind":"primary","statement_template_id":"22222222-2222-4222-8222-222222222205"},
    {"key":"witness","label":"Witness","kind":"supporting","statement_template_id":"22222222-2222-4222-8222-222222222206"}
  ]'::jsonb,
  decline_reasons = '[{"key":"no_premises","label":"No premises described"}]'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111103';

UPDATE public.case_templates
SET public_slug = 'housing-disrepair'
WHERE id = 'e379d75d-6585-4679-b520-60ac67e81e66'
  AND public_slug IS NULL;

INSERT INTO public.lead_channels (tenant_id, lead_type_id, public_key, enabled)
SELECT tenants.id, case_templates.id, encode(gen_random_bytes(24), 'hex'), true
FROM public.tenants
JOIN public.case_templates
  ON case_templates.public_slug IN (
    'road-traffic-collision',
    'public-liability',
    'housing-disrepair'
  )
WHERE lower(tenants.public_slug) = 'demo'
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_channels
    WHERE lead_channels.tenant_id = tenants.id
      AND lead_channels.lead_type_id = case_templates.id
  );
