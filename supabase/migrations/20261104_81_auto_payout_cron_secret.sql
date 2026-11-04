-- Security fix: auto-trigger-payouts had no caller check, and this function, which starts it,
-- was executable by anon and authenticated through the API.
--
-- The schedule now sends a shared secret that the Edge Function compares against
-- AUTO_PAYOUT_CRON_SECRET. The value lives in Vault as 'auto_payout_cron_secret', so it stays out
-- of this file. With no Vault entry the header is empty and the function refuses the request.

create or replace function public.auto_trigger_payouts_cron()
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'auto_payout_cron_secret';

  perform net.http_post(
    url     := 'https://fkhfbifgvebygafsewot.supabase.co/functions/v1/auto-trigger-payouts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraGZiaWZndmVieWdhZnNld290Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzk5NTMsImV4cCI6MjA5Mjg1NTk1M30.5pKeaQV6KnGQy4QBKCcb6huv8aEAdLBGF9hVkRL5pWo',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- pg_cron runs this as postgres, which keeps its access as the owner.
revoke all on function public.auto_trigger_payouts_cron() from public, anon, authenticated;
