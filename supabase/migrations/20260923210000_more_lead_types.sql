-- Accident at work and clinical negligence become public lead types.
-- Statement templates already exist. This only fills lead-type content.

UPDATE public.case_templates
SET
  public_slug = 'accident-at-work',
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
    {"key":"claimant","label":"Claimant","kind":"primary","statement_template_id":"22222222-2222-4222-8222-222222222203"},
    {"key":"colleague","label":"Colleague","kind":"supporting","statement_template_id":"22222222-2222-4222-8222-222222222204"}
  ]'::jsonb,
  decline_reasons = '[{"key":"no_employer","label":"No employer described"}]'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111102';

UPDATE public.case_templates
SET
  public_slug = 'clinical-negligence',
  outreach_template = 'Hi, you were named as a {role} for {firm} regarding {summary}. We are kindly requesting your account.',
  qualification_slots = '[
    {"id":"name","label":"Your name","type":"text","required":true,"reserved":"name"},
    {"id":"email","label":"Email","type":"text","required":false,"reserved":"email"},
    {"id":"phone","label":"Phone","type":"text","required":false,"reserved":"phone"},
    {"id":"what","label":"What treatment took place","type":"long_text","required":true},
    {"id":"when","label":"When it happened","type":"date","required":true,"include_in_outreach":true},
    {"id":"after","label":"What changed afterwards","type":"long_text","required":true}
  ]'::jsonb,
  participant_roles = '[
    {"key":"patient","label":"Patient","kind":"primary","statement_template_id":"22222222-2222-4222-8222-222222222207"},
    {"key":"family","label":"Family member","kind":"supporting","statement_template_id":"22222222-2222-4222-8222-222222222208"}
  ]'::jsonb,
  decline_reasons = '[{"key":"no_treatment","label":"No treatment described"}]'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111104';
