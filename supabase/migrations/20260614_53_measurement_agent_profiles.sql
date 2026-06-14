-- Migration: 20260614_53_measurement_agent_profiles
-- Creates the measurement_agent_profiles table with RLS policies
-- Idempotent: safe to re-run

create table if not exists public.measurement_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  phone_number text,
  base_city text not null,
  base_country text not null,
  id_document_url text,
  selfie_url text,
  equipment_photo_url text,
  certification_test_passed boolean not null default false,
  service_agreement_signed_at timestamptz,
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
alter table public.measurement_agent_profiles enable row level security;

-- Policy 1: Owner INSERT
drop policy if exists "measurement_agent_profiles_owner_insert" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_owner_insert"
  on public.measurement_agent_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

-- Policy 2: Owner SELECT
drop policy if exists "measurement_agent_profiles_owner_select" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_owner_select"
  on public.measurement_agent_profiles
  for select
  to authenticated
  using (
    auth.uid() = (select user_id from public.profiles where id = profile_id)
  );

-- Policy 3: Admin SELECT
drop policy if exists "measurement_agent_profiles_admin_select" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_admin_select"
  on public.measurement_agent_profiles
  for select
  to authenticated
  using (
    (select is_admin())
  );

-- Policy 4: Admin UPDATE
drop policy if exists "measurement_agent_profiles_admin_update" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_admin_update"
  on public.measurement_agent_profiles
  for update
  to authenticated
  using (
    (select is_admin())
  );
