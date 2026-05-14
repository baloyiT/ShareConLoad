-- Add bank confirmation letter URL to operator_profiles
alter table public.operator_profiles
  add column if not exists bank_confirmation_letter_url text;

-- Create private storage bucket for bank documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-documents',
  'bank-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Operators can upload to their own folder (path: {operator_profile_id}/filename)
create policy "Operators upload own bank docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bank-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

-- Operators can update (replace) their own docs
create policy "Operators update own bank docs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'bank-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

-- Operators can read their own docs
create policy "Operators read own bank docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bank-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

-- Admins can read all bank docs
create policy "Admins read all bank docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bank-documents'
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and role_type = 'admin'
    )
  );
