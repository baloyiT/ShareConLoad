-- Front door: public directory data (Module A).
-- operator_profiles holds bank and identity data and gets no public policy. Anonymous visitors
-- read listed operators only through these functions, which return a fixed set of safe columns.
-- operator_is_listed() is the single listing test.

create table if not exists public.operator_contact_views (
  id                  uuid primary key default gen_random_uuid(),
  operator_profile_id uuid not null references public.operator_profiles(id) on delete cascade,
  viewed_at           timestamptz not null default now()
);

create index if not exists operator_contact_views_operator_idx
  on public.operator_contact_views (operator_profile_id, viewed_at desc);

alter table public.operator_contact_views enable row level security;

-- Written only by get_operator_contact. No write policy, and no write grant either.
revoke all on table public.operator_contact_views from anon, authenticated;
grant select on table public.operator_contact_views to authenticated;

drop policy if exists "Admins read operator contact views" on public.operator_contact_views;
create policy "Admins read operator contact views" on public.operator_contact_views
  for select to authenticated using (public.is_admin());

create or replace function public.get_directory_operator(op_id uuid)
returns table (
  id                 uuid,
  display_name       text,
  public_description text,
  verification_level text,
  services           text[],
  coverage           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    op.id,
    op.legal_name,
    op.public_description,
    op.verification_level,
    array(
      select sc.name
      from public.operator_services s
      join public.service_categories sc on sc.id = s.service_category_id
      where s.operator_profile_id = op.id and sc.is_active
      order by sc.sort_order, sc.name
    ),
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'operator_profile_id', c.operator_profile_id,
        'origin_country', c.origin_country,
        'origin_city', c.origin_city,
        'destination_country', c.destination_country,
        'destination_city', c.destination_city,
        'transport_mode', c.transport_mode
      ) order by c.origin_country, c.origin_city, c.destination_country, c.destination_city), '[]'::jsonb)
      from public.operator_coverage c
      where c.operator_profile_id = op.id
    )
  from public.operator_profiles op
  where op.id = op_id
    and public.operator_is_listed(op.id);
$$;

-- Filters are compared as plain values: no dynamic SQL and no LIKE patterns, so anything a
-- visitor sends is only data. p_service is a service_categories slug. Blank counts as no filter.
-- Route and mode must all match on the same coverage row. A null city covers the whole country.
-- A country-wide row needs the country to have been searched for: from a city alone we cannot
-- tell that the city is in that country.
-- An unknown p_mode returns no rows. A coverage row with a null transport_mode matches a mode only
-- if the operator has an active service in that mode, or one with no mode (such as forwarding):
-- a customer searching air should not see a sea-only operator.
-- At most 100 rows, in name order.
create or replace function public.search_directory(
  p_service             text default null,
  p_mode                text default null,
  p_origin_country      text default null,
  p_origin_city         text default null,
  p_destination_country text default null,
  p_destination_city    text default null
)
returns table (
  id                 uuid,
  display_name       text,
  public_description text,
  verification_level text,
  services           text[],
  coverage           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select
      nullif(lower(trim(p_service)), '')             as service,
      nullif(lower(trim(p_mode)), '')                as mode,
      nullif(lower(trim(p_origin_country)), '')      as origin_country,
      nullif(lower(trim(p_origin_city)), '')         as origin_city,
      nullif(lower(trim(p_destination_country)), '') as destination_country,
      nullif(lower(trim(p_destination_city)), '')    as destination_city
  ),
  matched as (
    select op.id
    from public.operator_profiles op
    cross join f
    where public.operator_is_listed(op.id)
      and (f.mode is null or f.mode = any(enum_range(null::public.transport_mode)::text[]))
      and (f.service is null or exists (
        select 1
        from public.operator_services s
        join public.service_categories sc on sc.id = s.service_category_id
        where s.operator_profile_id = op.id
          and sc.is_active
          and sc.slug = f.service
      ))
      and exists (
        select 1
        from public.operator_coverage c
        where c.operator_profile_id = op.id
          and (f.mode is null
            or c.transport_mode::text = f.mode
            or (c.transport_mode is null and exists (
              select 1
              from public.operator_services s
              join public.service_categories sc on sc.id = s.service_category_id
              where s.operator_profile_id = op.id
                and sc.is_active
                and (sc.transport_mode is null or sc.transport_mode::text = f.mode)
            )))
          and (f.origin_country is null or lower(c.origin_country) = f.origin_country)
          and (f.origin_city is null
            or lower(c.origin_city) = f.origin_city
            or (c.origin_city is null and f.origin_country is not null))
          and (f.destination_country is null or lower(c.destination_country) = f.destination_country)
          and (f.destination_city is null
            or lower(c.destination_city) = f.destination_city
            or (c.destination_city is null and f.destination_country is not null))
      )
    order by op.legal_name, op.id
    limit 100
  )
  select d.*
  from matched m
  cross join lateral public.get_directory_operator(m.id) d
  order by d.display_name, d.id;
$$;

-- Anyone can call this, and it writes a row. Nothing is returned or written for an unlisted
-- operator. Recording stops at 60 views per operator per hour, so a script cannot fill the table
-- without limit: the contact is still returned, the extra view just isn't counted.
create or replace function public.get_operator_contact(op_id uuid)
returns table (public_phone text, public_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hourly_cap constant int := 60;
begin
  if public.operator_is_listed(op_id) is not true then
    return;
  end if;

  if (
    select count(*)
    from public.operator_contact_views v
    where v.operator_profile_id = op_id
      and v.viewed_at > now() - interval '1 hour'
  ) < v_hourly_cap then
    insert into public.operator_contact_views (operator_profile_id) values (op_id);
  end if;

  return query
    select op.public_phone, op.public_email
    from public.operator_profiles op
    where op.id = op_id;
end;
$$;

revoke all on function public.get_directory_operator(uuid) from public;
revoke all on function public.search_directory(text, text, text, text, text, text) from public;
revoke all on function public.get_operator_contact(uuid) from public;
grant execute on function public.get_directory_operator(uuid) to anon, authenticated;
grant execute on function public.search_directory(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_operator_contact(uuid) to anon, authenticated;
