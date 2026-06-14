-- Migration: 20260614_54_transporter_profiles
-- Creates the transporter_profiles table with RLS policies
-- Idempotent: safe to re-run

create table if not exists public.transporter_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  phone_number text,
  base_city text not null,
  base_country text not null,
  vehicle_type text not null check (vehicle_type in ('bakkie','small_truck','large_truck')),
  vehicle_capacity_kg numeric,
  vehicle_capacity_cbm numeric,
  vehicle_registration_number text,
  drivers_licence_url text,
  vehicle_ownership_url text,
  vehicle_photo_1_url text,
  vehicle_photo_2_url text,
  vehicle_photo_3_url text,
  vehicle_photo_4_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  rejection_reason text,
  average_rating numeric(3,2),
  total_jobs_completed int not null default 0,
  paystack_recipient_code text,
  payout_enabled boolean not null default false,
  payout_hold boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS (idempotent in Postgres)
alter table public.transporter_profiles enable row level security;

-- Policy 1: Owner INSERT
drop policy if exists "transporter_profiles_owner_insert" on public.transporter_profiles;
create policy "transporter_profiles_owner_insert"
  on public.transporter_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

-- Policy 2: Owner SELECT
drop policy if exists "transporter_profiles_owner_select" on public.transporter_profiles;
create policy "transporter_profiles_owner_select"
  on public.transporter_profiles
  for select
  to authenticated
  using (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

-- Policy 3: Admin SELECT
drop policy if exists "transporter_profiles_admin_select" on public.transporter_profiles;
create policy "transporter_profiles_admin_select"
  on public.transporter_profiles
  for select
  to authenticated
  using (
    (select is_admin())
  );

-- Policy 4: Admin UPDATE
drop policy if exists "transporter_profiles_admin_update" on public.transporter_profiles;
create policy "transporter_profiles_admin_update"
  on public.transporter_profiles
  for update
  to authenticated
  using (
    (select is_admin())
  );
