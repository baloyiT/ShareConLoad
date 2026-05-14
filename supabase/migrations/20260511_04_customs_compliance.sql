-- supabase/migrations/20260511_04_customs_compliance.sql

do $$ begin
  create type customs_event_type as enum (
    'inspection', 'hold', 'released', 'duty_pending',
    'documents_requested', 'seized', 'cleared'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type compliance_flag_type as enum (
    'prohibited_cargo', 'sanctions_risk', 'suspicious_payment',
    'customs_risk', 'fraud_risk', 'unverified_identity'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.customs_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type customs_event_type not null,
  description text,
  recorded_by uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.compliance_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('booking', 'profile', 'operator_profile')),
  target_id uuid not null,
  flag_type compliance_flag_type not null,
  description text,
  raised_by uuid references public.profiles(id),
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customs_events add column if not exists event_type customs_event_type;
alter table public.customs_events add column if not exists description text;
alter table public.customs_events add column if not exists recorded_by uuid references public.profiles(id);
alter table public.customs_events add column if not exists occurred_at timestamptz not null default now();

alter table public.compliance_flags add column if not exists target_type text;
alter table public.compliance_flags add column if not exists target_id uuid;
alter table public.compliance_flags add column if not exists flag_type compliance_flag_type;
alter table public.compliance_flags add column if not exists description text;
alter table public.compliance_flags add column if not exists raised_by uuid references public.profiles(id);
alter table public.compliance_flags add column if not exists resolved boolean not null default false;
alter table public.compliance_flags add column if not exists resolved_by uuid references public.profiles(id);
alter table public.compliance_flags add column if not exists resolved_at timestamptz;

alter table public.customs_events enable row level security;
alter table public.compliance_flags enable row level security;

do $$ begin
  create policy "customers_view_customs_events" on public.customs_events
    for select using (
      booking_id in (
        select id from public.bookings where customer_id = (
          select id from public.profiles where user_id = auth.uid()
        )
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_customs_events" on public.customs_events
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_compliance_flags" on public.compliance_flags
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

create index if not exists idx_customs_events_booking_id on public.customs_events(booking_id);
create index if not exists idx_compliance_flags_target_id on public.compliance_flags(target_id);
create index if not exists idx_compliance_flags_resolved on public.compliance_flags(resolved);
