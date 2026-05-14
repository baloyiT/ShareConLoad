-- supabase/migrations/20260511_02_shipment_milestones.sql

do $$ begin
  create type milestone_type as enum (
    'booking_confirmed',
    'cargo_received',
    'container_loaded',
    'vessel_departed',
    'customs_hold',
    'destination_arrival',
    'customs_cleared',
    'release_authorized',
    'cargo_collected',
    'shipment_completed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.shipment_milestones (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  milestone milestone_type not null,
  notes text,
  recorded_by uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.shipment_milestones add column if not exists milestone milestone_type;
alter table public.shipment_milestones add column if not exists notes text;
alter table public.shipment_milestones add column if not exists recorded_by uuid references public.profiles(id);
alter table public.shipment_milestones add column if not exists occurred_at timestamptz not null default now();

alter table public.shipment_milestones enable row level security;

do $$ begin
  create policy "customers_view_own_milestones" on public.shipment_milestones
    for select using (
      booking_id in (
        select id from public.bookings where customer_id = (
          select id from public.profiles where user_id = auth.uid()
        )
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "operators_view_container_milestones" on public.shipment_milestones
    for select using (
      booking_id in (
        select b.id from public.bookings b
        join public.containers c on c.id = b.container_id
        where c.operator_id = (
          select id from public.profiles where user_id = auth.uid()
        )
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "operators_insert_milestones" on public.shipment_milestones
    for insert with check (
      exists (
        select 1 from public.profiles
        where user_id = auth.uid() and role_type in ('admin', 'operator')
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_milestones" on public.shipment_milestones
    for all using (
      exists (
        select 1 from public.profiles
        where user_id = auth.uid() and role_type = 'admin'
      )
    );
exception when duplicate_object then null; end $$;

create index if not exists idx_milestones_booking_id on public.shipment_milestones(booking_id);
create index if not exists idx_milestones_occurred_at on public.shipment_milestones(occurred_at);
