-- supabase/migrations/20260613_45_customer_kyc.sql
-- Customer KYC: personal details + document verification before first booking

create table if not exists public.customer_kyc (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  full_name             text not null,
  date_of_birth         date,
  id_type               text not null check (id_type in ('national_id', 'passport', 'drivers_license')),
  id_number             text not null,
  phone_number          text,
  residential_address   text,
  id_document_url       text,
  proof_of_address_url  text,
  status                text not null default 'pending_review'
    check (status in ('pending_review', 'verified', 'rejected')),
  rejection_reason      text,
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  unique (profile_id)
);

alter table public.customer_kyc enable row level security;

-- Customers read/write their own row
do $$ begin
  create policy "Customers read own KYC"
    on public.customer_kyc for select
    to authenticated
    using (
      profile_id in (
        select id from public.profiles where user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Customers insert own KYC"
    on public.customer_kyc for insert
    to authenticated
    with check (
      profile_id in (
        select id from public.profiles where user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Customers update own KYC"
    on public.customer_kyc for update
    to authenticated
    using (
      profile_id in (
        select id from public.profiles where user_id = auth.uid()
      )
    )
    with check (
      profile_id in (
        select id from public.profiles where user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- Admins full access
do $$ begin
  create policy "Admins full access customer KYC"
    on public.customer_kyc for all
    to authenticated
    using (is_admin());
exception when duplicate_object then null; end $$;

-- Storage bucket: private, 10MB, PDF/image only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-kyc',
  'customer-kyc',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS
create policy "Customers upload own KYC docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'customer-kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Customers read own KYC docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'customer-kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Customers update own KYC docs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'customer-kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admins read all KYC docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'customer-kyc'
    and is_admin()
  );

create index if not exists idx_customer_kyc_profile_id on public.customer_kyc(profile_id);
create index if not exists idx_customer_kyc_status     on public.customer_kyc(status);
