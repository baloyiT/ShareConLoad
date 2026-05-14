-- supabase/migrations/20260511_01_payments_payouts.sql

do $$ begin
  create type payment_stage as enum ('deposit_20', 'pre_departure_50', 'final_release_30');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('pending', 'processing', 'completed', 'failed', 'on_hold');
exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stage payment_stage not null,
  amount numeric(12,2) not null,
  currency text not null default 'ZAR',
  status payment_status not null default 'pending',
  paystack_reference text,
  paystack_transaction_id text,
  paid_at timestamptz,
  due_date timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payments add column if not exists stage payment_stage;
alter table public.payments add column if not exists amount numeric(12,2);
alter table public.payments add column if not exists currency text not null default 'ZAR';
alter table public.payments add column if not exists status payment_status not null default 'pending';
alter table public.payments add column if not exists paystack_reference text;
alter table public.payments add column if not exists paystack_transaction_id text;
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists due_date timestamptz;

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  operator_id uuid not null references public.profiles(id),
  stage payment_stage not null,
  gross_amount numeric(12,2) not null,
  commission_rate numeric(5,4) not null default 0.05,
  commission_amount numeric(12,2) not null,
  net_amount numeric(12,2) not null,
  status payout_status not null default 'pending',
  paystack_transfer_code text,
  paystack_recipient_code text,
  hold_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payouts add column if not exists operator_id uuid references public.profiles(id);
alter table public.payouts add column if not exists stage payment_stage;
alter table public.payouts add column if not exists gross_amount numeric(12,2);
alter table public.payouts add column if not exists commission_rate numeric(5,4) not null default 0.05;
alter table public.payouts add column if not exists commission_amount numeric(12,2);
alter table public.payouts add column if not exists net_amount numeric(12,2);
alter table public.payouts add column if not exists status payout_status not null default 'pending';
alter table public.payouts add column if not exists paystack_transfer_code text;
alter table public.payouts add column if not exists paystack_recipient_code text;
alter table public.payouts add column if not exists hold_reason text;
alter table public.payouts add column if not exists paid_at timestamptz;

alter table public.payments enable row level security;
alter table public.payouts enable row level security;

do $$ begin
  create policy "customers_view_own_payments" on public.payments
    for select using (
      booking_id in (
        select id from public.bookings where customer_id = (
          select id from public.profiles where user_id = auth.uid()
        )
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "operators_view_own_payouts" on public.payouts
    for select using (
      operator_id = (select id from public.profiles where user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_payments" on public.payments
    for all using (
      exists (
        select 1 from public.profiles
        where user_id = auth.uid() and role_type = 'admin'
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_payouts" on public.payouts
    for all using (
      exists (
        select 1 from public.profiles
        where user_id = auth.uid() and role_type = 'admin'
      )
    );
exception when duplicate_object then null; end $$;

create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payouts_booking_id on public.payouts(booking_id);
create index if not exists idx_payouts_operator_id on public.payouts(operator_id);
create index if not exists idx_payouts_status on public.payouts(status);
