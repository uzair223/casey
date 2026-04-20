ALTER TABLE public.user_notifications
DROP CONSTRAINT IF EXISTS user_notifications_notification_type_check;

ALTER TABLE public.user_notifications
ADD CONSTRAINT user_notifications_notification_type_check
CHECK (
  notification_type IN (
    'case_note_mention',
    'statement_note_mention',
    'statement_submitted_for_review',
    'statement_final_review_requested'
  )
);

ALTER TABLE public.user_notifications
DROP CONSTRAINT IF EXISTS user_notifications_entity_type_check;

ALTER TABLE public.user_notifications
ADD CONSTRAINT user_notifications_entity_type_check
CHECK (
  entity_type IN (
    'case_note',
    'statement_note',
    'statement'
  )
);
