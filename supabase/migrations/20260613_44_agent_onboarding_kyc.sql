-- supabase/migrations/20260613_44_agent_onboarding_kyc.sql

-- Data migration: existing 'active' agents become 'approved'
update public.agent_profiles set status = 'approved' where status = 'active';

-- Drop old check constraint and add new one with all status values
alter table public.agent_profiles
  drop constraint if exists agent_profiles_status_check;

alter table public.agent_profiles
  add constraint agent_profiles_status_check
  check (status in ('draft', 'pending_review', 'approved', 'rejected'));

-- Step 1 extra fields
alter table public.agent_profiles
  add column if not exists operating_corridors  text[]      default '{}',
  add column if not exists years_in_operation   int,
  add column if not exists service_description  text;

-- Step 2: credentials
alter table public.agent_profiles
  add column if not exists license_number       text,
  add column if not exists license_authority    text,
  add column if not exists license_expiry       date,
  add column if not exists registration_number  text;

-- Step 3: document URLs (uploaded to Supabase Storage)
alter table public.agent_profiles
  add column if not exists doc_license_url       text,
  add column if not exists doc_business_reg_url  text,
  add column if not exists doc_identity_url      text,
  add column if not exists doc_proof_address_url text;

-- Step 4: bank details
alter table public.agent_profiles
  add column if not exists bank_name             text,
  add column if not exists bank_account_holder   text,
  add column if not exists bank_account_number   text,
  add column if not exists bank_branch_code      text;

-- Admin rejection
alter table public.agent_profiles
  add column if not exists rejection_reason      text;

-- Storage bucket for agent documents
insert into storage.buckets (id, name, public)
  values ('agent-documents', 'agent-documents', false)
  on conflict (id) do nothing;

-- Storage RLS: agents upload their own docs
drop policy if exists "agents_upload_own_docs" on storage.objects;
create policy "agents_upload_own_docs"
  on storage.objects for insert
  with check (
    bucket_id = 'agent-documents'
    and auth.uid() is not null
  );

drop policy if exists "agents_read_own_docs" on storage.objects;
create policy "agents_read_own_docs"
  on storage.objects for select
  using (
    bucket_id = 'agent-documents'
    and auth.uid() is not null
  );

drop policy if exists "admins_all_agent_docs" on storage.objects;
create policy "admins_all_agent_docs"
  on storage.objects for all
  using (bucket_id = 'agent-documents' and public.is_admin())
  with check (bucket_id = 'agent-documents' and public.is_admin());
