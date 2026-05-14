-- Fix admin RLS on compliance_documents table.
-- Original policy only checked role_type = 'admin'; align with all other admin gates.

drop policy if exists "Admins full access compliance docs" on public.compliance_documents;

create policy "Admins full access compliance docs"
  on public.compliance_documents for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );
