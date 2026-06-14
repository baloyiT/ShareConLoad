-- supabase/migrations/20260614_56_measurement_service_tables.sql

-- ── measurement_rate_bands ─────────────────────────────────────────────────────
create table if not exists measurement_rate_bands (
  id         uuid primary key default gen_random_uuid(),
  zone_name  text not null,
  base_fee   numeric not null,
  active     boolean not null default true,
  created_at timestamptz default now()
);

alter table measurement_rate_bands enable row level security;

drop policy if exists "Admin manages rate bands" on measurement_rate_bands;
create policy "Admin manages rate bands" on measurement_rate_bands
  for all using ((select is_admin()));

drop policy if exists "Anyone can read active rate bands" on measurement_rate_bands;
create policy "Anyone can read active rate bands" on measurement_rate_bands
  for select using (active = true);

-- ── measurement_jobs ──────────────────────────────────────────────────────────
create table if not exists measurement_jobs (
  id                             uuid primary key default gen_random_uuid(),
  shipper_profile_id             uuid not null references profiles(id) on delete cascade,
  measurement_agent_profile_id   uuid references measurement_agent_profiles(id),
  pickup_address                 text not null,
  pickup_city                    text not null,
  pickup_country                 text not null,
  quoted_fee                     numeric not null,
  status                         text not null default 'pending_payment'
                                   check (status in ('pending_payment','paid','assigned','in_progress','completed','cancelled')),
  payment_ref                    text,
  rate_band_id                   uuid references measurement_rate_bands(id),
  assigned_at                    timestamptz,
  started_at                     timestamptz,
  completed_at                   timestamptz,
  created_at                     timestamptz default now()
);

alter table measurement_jobs enable row level security;

drop policy if exists "Shipper views own jobs" on measurement_jobs;
create policy "Shipper views own jobs" on measurement_jobs
  for select using (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Agent views assigned jobs" on measurement_jobs;
create policy "Agent views assigned jobs" on measurement_jobs
  for select using (
    measurement_agent_profile_id in (
      select id from measurement_agent_profiles where profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Shipper can insert jobs" on measurement_jobs;
create policy "Shipper can insert jobs" on measurement_jobs
  for insert with check (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Admin manages all jobs" on measurement_jobs;
create policy "Admin manages all jobs" on measurement_jobs
  for all using ((select is_admin()));

-- ── measurement_job_items ─────────────────────────────────────────────────────
create table if not exists measurement_job_items (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references measurement_jobs(id) on delete cascade,
  description  text not null,
  quantity     int not null default 1,
  length_m     numeric,
  width_m      numeric,
  height_m     numeric,
  weight_kg    numeric,
  cbm_per_unit numeric,
  total_cbm    numeric,
  created_at   timestamptz default now()
);

alter table measurement_job_items enable row level security;

drop policy if exists "Agent can manage items for assigned job" on measurement_job_items;
create policy "Agent can manage items for assigned job" on measurement_job_items
  for all using (
    job_id in (
      select id from measurement_jobs
      where measurement_agent_profile_id in (
        select id from measurement_agent_profiles where profile_id in (
          select id from profiles where user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Shipper can view items" on measurement_job_items;
create policy "Shipper can view items" on measurement_job_items
  for select using (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Admin manages job items" on measurement_job_items;
create policy "Admin manages job items" on measurement_job_items
  for all using ((select is_admin()));

-- ── measurement_reports ───────────────────────────────────────────────────────
create table if not exists measurement_reports (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null unique references measurement_jobs(id) on delete cascade,
  total_cbm           numeric not null,
  total_weight_kg     numeric,
  item_count          int,
  platform_report_ref text unique,
  agent_notes         text,
  generated_at        timestamptz default now()
);

alter table measurement_reports enable row level security;

drop policy if exists "Shipper can view own report" on measurement_reports;
create policy "Shipper can view own report" on measurement_reports
  for select using (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Agent can insert report" on measurement_reports;
create policy "Agent can insert report" on measurement_reports
  for insert with check (
    job_id in (
      select id from measurement_jobs
      where measurement_agent_profile_id in (
        select id from measurement_agent_profiles where profile_id in (
          select id from profiles where user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Admin manages reports" on measurement_reports;
create policy "Admin manages reports" on measurement_reports
  for all using ((select is_admin()));

-- ── measurement_report_photos ─────────────────────────────────────────────────
create table if not exists measurement_report_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references measurement_reports(id) on delete cascade,
  photo_type  text not null check (photo_type in ('cargo_1','cargo_2','cargo_3','cargo_4','tape_measure','scale','location')),
  file_url    text not null,
  uploaded_at timestamptz default now()
);

alter table measurement_report_photos enable row level security;

drop policy if exists "Agent can insert photos" on measurement_report_photos;
create policy "Agent can insert photos" on measurement_report_photos
  for insert with check (
    report_id in (
      select id from measurement_reports where job_id in (
        select id from measurement_jobs
        where measurement_agent_profile_id in (
          select id from measurement_agent_profiles where profile_id in (
            select id from profiles where user_id = auth.uid()
          )
        )
      )
    )
  );

drop policy if exists "Shipper and admin can view photos" on measurement_report_photos;
create policy "Shipper and admin can view photos" on measurement_report_photos
  for select using (
    (select is_admin())
    or
    report_id in (
      select id from measurement_reports where job_id in (
        select id from measurement_jobs where shipper_profile_id in (
          select id from profiles where user_id = auth.uid()
        )
      )
    )
  );

-- ── measurement_job_payments ──────────────────────────────────────────────────
create table if not exists measurement_job_payments (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null unique references measurement_jobs(id) on delete cascade,
  paystack_ref text,
  amount       numeric not null,
  status       text not null default 'pending'
                 check (status in ('pending','paid','refunded','failed')),
  paid_at      timestamptz
);

alter table measurement_job_payments enable row level security;

drop policy if exists "Shipper can view own payment" on measurement_job_payments;
create policy "Shipper can view own payment" on measurement_job_payments
  for select using (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Shipper can insert payment" on measurement_job_payments;
create policy "Shipper can insert payment" on measurement_job_payments
  for insert with check (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Admin manages payments" on measurement_job_payments;
create policy "Admin manages payments" on measurement_job_payments
  for all using ((select is_admin()));
