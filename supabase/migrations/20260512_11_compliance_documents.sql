-- supabase/migrations/20260512_11_compliance_documents.sql

-- Table: one row per doc type per operator
create table if not exists public.compliance_documents (
  id                  uuid primary key default gen_random_uuid(),
  operator_profile_id uuid not null references public.operator_profiles(id) on delete cascade,
  doc_type            text not null check (doc_type in (
    'identity',
    'business_registration',
    'proof_of_address',
    'tax_clearance',
    'banking_confirmation'
  )),
  file_url            text not null,
  status              text not null default 'under_review'
    check (status in ('under_review', 'approved', 'rejected')),
  admin_notes         text,
  uploaded_at         timestamptz not null default now(),
  reviewed_at         timestamptz,
  unique (operator_profile_id, doc_type)
);

-- RLS
alter table public.compliance_documents enable row level security;

-- Operators: read/insert/update their own rows
do $$ begin
  create policy "Operators read own compliance docs"
    on public.compliance_documents for select
    to authenticated
    using (
      operator_profile_id in (
        select op.id from public.operator_profiles op
        join public.profiles p on p.id = op.profile_id
        where p.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Operators insert own compliance docs"
    on public.compliance_documents for insert
    to authenticated
    with check (
      operator_profile_id in (
        select op.id from public.operator_profiles op
        join public.profiles p on p.id = op.profile_id
        where p.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Operators update own compliance docs"
    on public.compliance_documents for update
    to authenticated
    using (
      operator_profile_id in (
        select op.id from public.operator_profiles op
        join public.profiles p on p.id = op.profile_id
        where p.user_id = auth.uid()
      )
    )
    with check (
      operator_profile_id in (
        select op.id from public.operator_profiles op
        join public.profiles p on p.id = op.profile_id
        where p.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- Admins: full access
do $$ begin
  create policy "Admins full access compliance docs"
    on public.compliance_documents for all
    to authenticated
    using (
      exists (
        select 1 from public.profiles
        where user_id = auth.uid() and role_type = 'admin'
      )
    );
exception when duplicate_object then null; end $$;

-- Storage bucket: private, 10 MB limit, PDF/image only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: operators upload to their own folder
create policy "Operators upload compliance docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

create policy "Operators update compliance docs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

create policy "Operators read own compliance docs storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

create policy "Admins read all compliance docs storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type = 'admin'
    )
  );

-- Indexes for query performance
create index if not exists idx_compliance_documents_operator_profile_id
  on public.compliance_documents(operator_profile_id);
create index if not exists idx_compliance_documents_status
  on public.compliance_documents(status);
create index if not exists idx_compliance_documents_uploaded_at
  on public.compliance_documents(uploaded_at);
