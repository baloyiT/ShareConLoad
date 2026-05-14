-- supabase/migrations/20260511_05_support_audit.sql

do $$ begin
  create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_priority as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id) on delete set null,
  subject text not null,
  description text not null,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'medium',
  assigned_to uuid references public.profiles(id),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.support_tickets add column if not exists submitted_by uuid references public.profiles(id);
alter table public.support_tickets add column if not exists booking_id uuid references public.bookings(id) on delete set null;
alter table public.support_tickets add column if not exists subject text;
alter table public.support_tickets add column if not exists description text;
alter table public.support_tickets add column if not exists status ticket_status not null default 'open';
alter table public.support_tickets add column if not exists priority ticket_priority not null default 'medium';
alter table public.support_tickets add column if not exists assigned_to uuid references public.profiles(id);
alter table public.support_tickets add column if not exists resolution_notes text;
alter table public.support_tickets add column if not exists resolved_at timestamptz;

alter table public.audit_logs add column if not exists actor_id uuid references public.profiles(id);
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists target_type text;
alter table public.audit_logs add column if not exists target_id uuid;
alter table public.audit_logs add column if not exists metadata jsonb default '{}';
alter table public.audit_logs add column if not exists ip_address text;

alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;

do $$ begin
  create policy "customers_view_own_tickets" on public.support_tickets
    for select using (submitted_by = (select id from public.profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customers_insert_tickets" on public.support_tickets
    for insert with check (submitted_by = (select id from public.profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_tickets" on public.support_tickets
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_view_audit_logs" on public.audit_logs
    for select using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

create index if not exists idx_support_tickets_submitted_by on public.support_tickets(submitted_by);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_target_id on public.audit_logs(target_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
