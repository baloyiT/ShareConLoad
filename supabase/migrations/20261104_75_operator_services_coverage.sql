-- Front door: what an operator offers and where they operate (Module A)
create table if not exists operator_services (
  id                  uuid primary key default gen_random_uuid(),
  operator_profile_id uuid not null references operator_profiles(id) on delete cascade,
  service_category_id uuid not null references service_categories(id) on delete cascade,
  unique (operator_profile_id, service_category_id)
);

create table if not exists operator_coverage (
  id                  uuid primary key default gen_random_uuid(),
  operator_profile_id uuid not null references operator_profiles(id) on delete cascade,
  origin_country      text not null,
  origin_city         text,
  destination_country text not null,
  destination_city    text,
  transport_mode      transport_mode
);

create index if not exists operator_services_operator_idx on operator_services (operator_profile_id);
create index if not exists operator_coverage_operator_idx on operator_coverage (operator_profile_id);

alter table operator_services enable row level security;
alter table operator_coverage enable row level security;

-- No anon or public read: the directory (later task) exposes these through its own path.

drop policy if exists "Operators manage own services" on operator_services;
create policy "Operators manage own services" on operator_services
  for all
  using (operator_profile_id in (
    select op.id from operator_profiles op join profiles p on p.id = op.profile_id
    where p.user_id = auth.uid()))
  with check (operator_profile_id in (
    select op.id from operator_profiles op join profiles p on p.id = op.profile_id
    where p.user_id = auth.uid()));

drop policy if exists "Admins manage operator services" on operator_services;
create policy "Admins manage operator services" on operator_services
  for all using (is_admin()) with check (is_admin());

drop policy if exists "Operators manage own coverage" on operator_coverage;
create policy "Operators manage own coverage" on operator_coverage
  for all
  using (operator_profile_id in (
    select op.id from operator_profiles op join profiles p on p.id = op.profile_id
    where p.user_id = auth.uid()))
  with check (operator_profile_id in (
    select op.id from operator_profiles op join profiles p on p.id = op.profile_id
    where p.user_id = auth.uid()));

drop policy if exists "Admins manage operator coverage" on operator_coverage;
create policy "Admins manage operator coverage" on operator_coverage
  for all using (is_admin()) with check (is_admin());
