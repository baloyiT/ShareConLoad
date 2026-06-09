-- supabase/migrations/20260609_42_agent_integration.sql

-- 1. agent_profiles
create table if not exists public.agent_profiles (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  business_name     text not null,
  contact_person    text,
  phone_number      text,
  country           text not null default 'South Africa',
  status            text not null default 'active' check (status in ('active', 'suspended')),
  created_at        timestamptz not null default now()
);

create unique index if not exists agent_profiles_profile_id_idx on public.agent_profiles(profile_id);

-- 2. agent_managed_shippers
create table if not exists public.agent_managed_shippers (
  id                uuid primary key default gen_random_uuid(),
  agent_profile_id  uuid not null references public.agent_profiles(id) on delete cascade,
  name              text not null,
  contact_email     text,
  contact_phone     text,
  country           text,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists agent_managed_shippers_agent_idx
  on public.agent_managed_shippers(agent_profile_id);

-- 3. Add agent columns to bookings
alter table public.bookings
  add column if not exists agent_profile_id    uuid references public.agent_profiles(id) on delete set null,
  add column if not exists managed_shipper_id  uuid references public.agent_managed_shippers(id) on delete set null;

create index if not exists bookings_agent_profile_id_idx on public.bookings(agent_profile_id);

-- 4. RLS: agent_profiles
alter table public.agent_profiles enable row level security;

drop policy if exists "agents_manage_own_profile" on public.agent_profiles;
create policy "agents_manage_own_profile"
  on public.agent_profiles for all
  using (
    profile_id = (
      select id from public.profiles where user_id = auth.uid()
    )
  )
  with check (
    profile_id = (
      select id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "admins_all_agent_profiles" on public.agent_profiles;
create policy "admins_all_agent_profiles"
  on public.agent_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5. RLS: agent_managed_shippers
alter table public.agent_managed_shippers enable row level security;

drop policy if exists "agents_manage_own_shippers" on public.agent_managed_shippers;
create policy "agents_manage_own_shippers"
  on public.agent_managed_shippers for all
  using (
    agent_profile_id = (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  )
  with check (
    agent_profile_id = (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "admins_all_managed_shippers" on public.agent_managed_shippers;
create policy "admins_all_managed_shippers"
  on public.agent_managed_shippers for all
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Allow agents to read bookings they facilitated
drop policy if exists "agents_view_facilitated_bookings" on public.bookings;
create policy "agents_view_facilitated_bookings"
  on public.bookings for select
  using (
    agent_profile_id = (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  );

-- 7. Allow agents to insert bookings (agent-facilitated)
drop policy if exists "agents_insert_facilitated_bookings" on public.bookings;
create policy "agents_insert_facilitated_bookings"
  on public.bookings for insert
  with check (
    agent_profile_id = (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  );
