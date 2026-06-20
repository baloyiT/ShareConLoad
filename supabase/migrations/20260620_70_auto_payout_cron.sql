-- Schedule daily auto-trigger for eligible pending payouts.
-- Calls the auto-trigger-payouts edge function via pg_net at 06:00 UTC daily.
-- The anon key is a publishable key — safe to embed here.
-- The edge function itself uses SUPABASE_SERVICE_ROLE_KEY for all DB operations.

-- SQL function that pg_cron calls
create or replace function public.auto_trigger_payouts_cron()
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url     := 'https://fkhfbifgvebygafsewot.supabase.co/functions/v1/auto-trigger-payouts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraGZiaWZndmVieWdhZnNld290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzk5NTMsImV4cCI6MjA5Mjg1NTk1M30.5pKeaQV6KnGQy4QBKCcb6huv8aEAdLBGF9hVkRL5pWo'
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Schedule: daily at 06:00 UTC. Unschedule first so this migration is idempotent.
do $$ begin
  perform cron.unschedule('auto-trigger-payouts-daily');
exception when others then null;
end $$;

select cron.schedule(
  'auto-trigger-payouts-daily',
  '0 6 * * *',
  $$select public.auto_trigger_payouts_cron()$$
);
