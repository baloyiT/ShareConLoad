-- supabase/migrations/20260511_09_payment_missing_columns.sql
-- Adds columns referenced by Edge Functions that were missing from the initial schema.

-- payments: timestamp set by process-refund and paystack-webhook refund.processed
alter table public.payments
  add column if not exists refunded_at timestamptz;

-- payouts: timestamp set by paystack-webhook transfer.success
alter table public.payouts
  add column if not exists completed_at timestamptz;

-- payouts: message set by paystack-webhook transfer.failed
alter table public.payouts
  add column if not exists failure_reason text;
