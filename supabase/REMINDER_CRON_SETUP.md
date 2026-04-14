# Supabase Reminder Cron Setup

This project now schedules reminder dispatches from Supabase (hourly) instead of Vercel Cron.

## One-time setup in Supabase SQL Editor

Run this in your Supabase project SQL editor, replacing placeholders with your deployed app URL and reminder secret.

```sql
INSERT INTO app_private.scheduler_config (key, value)
VALUES
	('site_url', 'https://your-app-domain.com'),
	('cron_secret', 'your-cron-secret')
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
```

Notes:

- scheduler_config key cron_secret must match your app environment variable CRON_SECRET.
- scheduler_config key site_url should be your public app origin without a trailing slash.

## Verify the cron job exists

```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'statement-reminders-hourly';
```

## Optional: run manually once

```sql
SELECT public.run_statement_reminders_job();
```

The function returns a request id from pg_net. You can inspect request details in net.\_http_response if needed.
