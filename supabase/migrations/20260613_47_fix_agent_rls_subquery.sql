-- supabase/migrations/20260613_47_fix_agent_rls_subquery.sql
-- Fix RLS policies that use = (subquery) on profiles — breaks when a user has
-- multiple profile rows (e.g. both customer + agent roles).
-- Replace with IN (subquery) which handles multiple rows safely.

-- agent_profiles
drop policy if exists "agents_manage_own_profile" on public.agent_profiles;
create policy "agents_manage_own_profile"
  on public.agent_profiles for all
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

-- agent_managed_shippers (same pattern via agent_profiles join)
drop policy if exists "agents_manage_own_shippers" on public.agent_managed_shippers;
create policy "agents_manage_own_shippers"
  on public.agent_managed_shippers for all
  using (
    agent_profile_id in (
      select ap.id from public.agent_profiles ap
      where ap.profile_id in (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  )
  with check (
    agent_profile_id in (
      select ap.id from public.agent_profiles ap
      where ap.profile_id in (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  );
