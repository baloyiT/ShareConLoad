-- Admin SELECT policy on profiles
-- Without this, admin queries against profiles (e.g. /admin/operators)
-- silently return only the admin's own row due to the self-access policy.
drop policy if exists "admins_all_profiles" on public.profiles;
create policy "admins_all_profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and (p.is_admin = true or p.role_type = 'admin')
    )
  );
