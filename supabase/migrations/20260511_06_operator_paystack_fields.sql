-- supabase/migrations/20260511_06_operator_paystack_fields.sql

alter table public.operator_profiles
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_code text,
  add column if not exists paystack_recipient_code text,
  add column if not exists payout_enabled boolean not null default false,
  add column if not exists payout_hold boolean not null default false,
  add column if not exists payout_hold_reason text;
