-- supabase/migrations/20260511_07_cargo_release.sql

do $$ begin
  create type release_status as enum ('pending', 'authorized', 'released', 'held');
exception when duplicate_object then null; end $$;

create table if not exists public.cargo_release_authorizations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  final_payment_confirmed boolean not null default false,
  customs_cleared boolean not null default false,
  consignee_verified boolean not null default false,
  operator_confirmed boolean not null default false,
  status release_status not null default 'pending',
  authorized_by uuid references public.profiles(id),
  authorized_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cargo_release_authorizations add column if not exists final_payment_confirmed boolean not null default false;
alter table public.cargo_release_authorizations add column if not exists customs_cleared boolean not null default false;
alter table public.cargo_release_authorizations add column if not exists consignee_verified boolean not null default false;
alter table public.cargo_release_authorizations add column if not exists operator_confirmed boolean not null default false;
alter table public.cargo_release_authorizations add column if not exists status release_status not null default 'pending';
alter table public.cargo_release_authorizations add column if not exists authorized_by uuid references public.profiles(id);
alter table public.cargo_release_authorizations add column if not exists authorized_at timestamptz;
alter table public.cargo_release_authorizations add column if not exists notes text;

alter table public.cargo_release_authorizations enable row level security;

do $$ begin
  create policy "customers_view_own_release" on public.cargo_release_authorizations
    for select using (
      booking_id in (
        select id from public.bookings where customer_id = (
          select id from public.profiles where user_id = auth.uid()
        )
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_release" on public.cargo_release_authorizations
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

create unique index if not exists idx_cargo_release_booking_id on public.cargo_release_authorizations(booking_id);
