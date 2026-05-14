-- supabase/migrations/20260511_03_disputes_claims.sql

do $$ begin
  create type dispute_type as enum (
    'cargo_damage', 'cargo_missing', 'shipment_delay',
    'customs_issue', 'refund_request', 'operator_conduct'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_status as enum (
    'submitted', 'under_review', 'awaiting_evidence',
    'resolved_customer', 'resolved_operator', 'closed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  dispute_type dispute_type not null,
  description text not null,
  status dispute_status not null default 'submitted',
  resolution_notes text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Ensure columns exist if table was previously created with a different schema
alter table public.disputes add column if not exists submitted_by uuid references public.profiles(id);
alter table public.disputes add column if not exists dispute_type dispute_type;
alter table public.disputes add column if not exists description text;
alter table public.disputes add column if not exists status dispute_status not null default 'submitted';
alter table public.disputes add column if not exists resolution_notes text;
alter table public.disputes add column if not exists resolved_by uuid references public.profiles(id);
alter table public.disputes add column if not exists resolved_at timestamptz;

create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_url text not null,
  file_name text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.dispute_evidence add column if not exists uploaded_by uuid references public.profiles(id);
alter table public.dispute_evidence add column if not exists file_url text;
alter table public.dispute_evidence add column if not exists file_name text;

create table if not exists public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  dispute_id uuid references public.disputes(id),
  submitted_by uuid not null references public.profiles(id),
  claim_amount numeric(12,2),
  description text not null,
  status text not null default 'submitted',
  insurer_reference text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.insurance_claims add column if not exists submitted_by uuid references public.profiles(id);
alter table public.insurance_claims add column if not exists dispute_id uuid references public.disputes(id);
alter table public.insurance_claims add column if not exists claim_amount numeric(12,2);
alter table public.insurance_claims add column if not exists description text;
alter table public.insurance_claims add column if not exists status text not null default 'submitted';
alter table public.insurance_claims add column if not exists insurer_reference text;
alter table public.insurance_claims add column if not exists resolved_at timestamptz;

alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.insurance_claims enable row level security;

do $$ begin
  create policy "customers_view_own_disputes" on public.disputes
    for select using (submitted_by = (select id from public.profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customers_insert_disputes" on public.disputes
    for insert with check (submitted_by = (select id from public.profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dispute_parties_view_evidence" on public.dispute_evidence
    for select using (
      dispute_id in (
        select id from public.disputes
        where submitted_by = (select id from public.profiles where user_id = auth.uid())
      )
      or exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "dispute_parties_upload_evidence" on public.dispute_evidence
    for insert with check (
      uploaded_by = (select id from public.profiles where user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_disputes" on public.disputes
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_dispute_evidence" on public.dispute_evidence
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customers_view_own_claims" on public.insurance_claims
    for select using (submitted_by = (select id from public.profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "customers_insert_claims" on public.insurance_claims
    for insert with check (submitted_by = (select id from public.profiles where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admins_all_claims" on public.insurance_claims
    for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));
exception when duplicate_object then null; end $$;

create index if not exists idx_disputes_booking_id on public.disputes(booking_id);
create index if not exists idx_disputes_status on public.disputes(status);
create index if not exists idx_dispute_evidence_dispute_id on public.dispute_evidence(dispute_id);
create index if not exists idx_insurance_claims_booking_id on public.insurance_claims(booking_id);
