-- Fix admin storage RLS for compliance-documents bucket.
-- Original policy only checked role_type = 'admin' but admin users may have
-- is_admin = true with a different role_type. Align with all other admin gates.

drop policy if exists "Admins read all compliance docs storage" on storage.objects;

create policy "Admins read all compliance docs storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );
