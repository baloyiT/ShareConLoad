-- Front door: freight service taxonomy (Module A)
do $$ begin
  create type transport_mode as enum ('sea', 'air', 'road', 'rail');
exception when duplicate_object then null; end $$;

create table if not exists service_categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  transport_mode transport_mode,
  parent_id      uuid references service_categories(id) on delete set null,
  sort_order     int not null default 0,
  is_active      boolean not null default true
);

alter table service_categories enable row level security;

drop policy if exists "Anyone reads service categories" on service_categories;
create policy "Anyone reads service categories" on service_categories
  for select using (is_active or is_admin());

drop policy if exists "Admins manage service categories" on service_categories;
create policy "Admins manage service categories" on service_categories
  for all using (is_admin()) with check (is_admin());

insert into service_categories (name, slug, transport_mode, sort_order) values
  ('Sea freight',        'sea-freight',        'sea',  10),
  ('Air freight',        'air-freight',        'air',  20),
  ('Road freight',       'road-freight',       'road', 30),
  ('Rail freight',       'rail-freight',       'rail', 40),
  ('Freight forwarding', 'forwarding',         null,   50),
  ('Customs clearing',   'customs-clearing',   null,   60),
  ('Consolidation',      'consolidation',      null,   70),
  ('Warehousing',        'warehousing',        null,   80),
  ('Household removals', 'household-removals', null,   90),
  ('Oversized cargo',    'oversized-cargo',    null,  100)
on conflict (slug) do nothing;
