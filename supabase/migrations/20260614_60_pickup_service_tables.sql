-- supabase/migrations/20260614_60_pickup_service_tables.sql

-- transporter_rate_bands
create table if not exists transporter_rate_bands (
  id                uuid primary key default gen_random_uuid(),
  zone_name         text not null,
  origin_city       text not null,
  origin_country    text not null,
  base_fee          numeric not null check (base_fee > 0),
  per_cbm_fee       numeric not null default 0 check (per_cbm_fee >= 0),
  vehicle_type      text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

alter table transporter_rate_bands enable row level security;

drop policy if exists "admin_all_transporter_rate_bands" on transporter_rate_bands;
create policy "admin_all_transporter_rate_bands" on transporter_rate_bands
  for all using ((select is_admin()));

drop policy if exists "authenticated_select_active_transporter_rate_bands" on transporter_rate_bands;
create policy "authenticated_select_active_transporter_rate_bands" on transporter_rate_bands
  for select using (active = true and auth.role() = 'authenticated');

-- pickup_jobs
create table if not exists pickup_jobs (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id),
  shipper_profile_id          uuid not null references profiles(id),
  transporter_profile_id      uuid references transporter_profiles(id),
  pickup_address              text not null,
  pickup_city                 text not null,
  pickup_country              text not null,
  warehouse_address           text not null,
  total_cbm                   numeric,
  total_weight_kg             numeric,
  quoted_fee                  numeric not null check (quoted_fee > 0),
  status                      text not null default 'pending_selection'
                                check (status in ('pending_selection','pending_payment','paid','assigned','collected','delivered','cancelled')),
  shortlisted_transporter_ids uuid[],
  payment_ref                 text,
  selected_at                 timestamptz,
  collected_at                timestamptz,
  delivered_at                timestamptz,
  payout_released_at          timestamptz,
  created_at                  timestamptz not null default now()
);

alter table pickup_jobs enable row level security;

drop policy if exists "shipper_select_own_pickup_jobs" on pickup_jobs;
create policy "shipper_select_own_pickup_jobs" on pickup_jobs
  for select using (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "shipper_insert_pickup_jobs" on pickup_jobs;
create policy "shipper_insert_pickup_jobs" on pickup_jobs
  for insert with check (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "transporter_select_assigned_pickup_jobs" on pickup_jobs;
create policy "transporter_select_assigned_pickup_jobs" on pickup_jobs
  for select using (
    transporter_profile_id in (
      select tp.id from transporter_profiles tp
      join profiles p on p.id = tp.profile_id
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "admin_all_pickup_jobs" on pickup_jobs;
create policy "admin_all_pickup_jobs" on pickup_jobs
  for all using ((select is_admin()));

-- pickup_job_payments
create table if not exists pickup_job_payments (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null unique references pickup_jobs(id),
  paystack_ref   text,
  amount         numeric not null check (amount > 0),
  status         text not null default 'pending'
                   check (status in ('pending','paid','refunded','failed')),
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

alter table pickup_job_payments enable row level security;

drop policy if exists "admin_all_pickup_job_payments" on pickup_job_payments;
create policy "admin_all_pickup_job_payments" on pickup_job_payments
  for all using ((select is_admin()));

drop policy if exists "shipper_select_own_pickup_payments" on pickup_job_payments;
create policy "shipper_select_own_pickup_payments" on pickup_job_payments
  for select using (
    job_id in (
      select id from pickup_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );
