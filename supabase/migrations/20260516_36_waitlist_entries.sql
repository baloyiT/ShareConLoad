-- supabase/migrations/20260516_36_waitlist_entries.sql

create table if not exists waitlist_entries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  first_name    text not null,
  last_name     text not null,
  email         text not null unique,
  phone         text,
  country       text,
  business_type text,
  role          text not null default 'other'
);

alter table waitlist_entries enable row level security;

drop policy if exists "waitlist_public_insert" on waitlist_entries;
create policy "waitlist_public_insert"
  on waitlist_entries for insert
  to anon, authenticated
  with check (true);

drop policy if exists "waitlist_admin_select" on waitlist_entries;
create policy "waitlist_admin_select"
  on waitlist_entries for select
  to authenticated
  using (is_admin());
