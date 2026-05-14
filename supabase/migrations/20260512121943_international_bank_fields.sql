alter table public.operator_profiles
  add column if not exists bank_country      text,
  add column if not exists bank_swift_code   text,
  add column if not exists payout_method     text default 'paystack'
    check (payout_method in ('paystack', 'manual'));
