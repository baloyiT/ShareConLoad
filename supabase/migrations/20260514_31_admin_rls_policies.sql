-- Admin RLS policies for tables missing admin access
-- bookings, containers, and operator_profiles had no admin policy,
-- causing admin pages to return 0 rows silently.

drop policy if exists "admins_all_bookings" on public.bookings;
create policy "admins_all_bookings"
  on public.bookings for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  );

drop policy if exists "admins_all_containers" on public.containers;
create policy "admins_all_containers"
  on public.containers for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  );

drop policy if exists "admins_all_operator_profiles" on public.operator_profiles;
create policy "admins_all_operator_profiles"
  on public.operator_profiles for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and (profiles.is_admin = true or profiles.role_type = 'admin')
    )
  );
