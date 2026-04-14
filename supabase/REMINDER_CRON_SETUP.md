# Supabase Reminder Cron Setup

This project now schedules reminder dispatches from Supabase (hourly) instead of Vercel Cron.

## What was added

- Migration: supabase/migrations/20260414200000_statement_reminders_supabase_cron.sql
- Scheduled job name: statement-reminders-hourly
- Frequency: 0 \* \* \* \* (once per hour)

## One-time setup in Supabase SQL Editor

Run this in your Supabase project SQL editor, replacing placeholders with your deployed app URL and reminder secret.

```sql
ALTER DATABASE postgres
SET app.settings.site_url = 'https://your-app-domain.com';

ALTER DATABASE postgres
SET app.settings.cron_secret = 'your-cron-secret';

SELECT pg_reload_conf();
```

Notes:

- app.settings.cron_secret must match your app environment variable CRON_SECRET.
- app.settings.site_url should be your public app origin without a trailing slash.

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
