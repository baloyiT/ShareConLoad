-- Follows _94. Closes the insert checks it left open and moves the remaining
-- `= (select ... profiles ...)` policies to IN. Admins keep their own policies.
-- payouts.operators_view_own_payouts is left alone on purpose: operator_id holds the auth
-- user id, so IN on profile ids would match nothing. It needs a policy and a page change.

-- A customer opens a dispute as themselves and in its first status. Defaults are applied
-- before this check, so the pages, which send neither column, still pass.
drop policy if exists "customers_insert_disputes" on public.disputes;
create policy "customers_insert_disputes" on public.disputes
  for insert with check (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
    and booking_id in (select id from public.bookings where customer_id = (select auth.uid()))
    and status = 'open'
    and raised_by = (select auth.uid())
  );

-- A claim must be on the caller's booking, and on the caller's dispute if it names one.
drop policy if exists "customers_insert_claims" on public.insurance_claims;
create policy "customers_insert_claims" on public.insurance_claims
  for insert with check (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
    and booking_id in (select id from public.bookings where customer_id = (select auth.uid()))
    and (
      dispute_id is null
      or dispute_id in (
        select d.id from public.disputes d
        join public.profiles p on p.id = d.submitted_by
        where p.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "customers_view_own_tickets" on public.support_tickets;
create policy "customers_view_own_tickets" on public.support_tickets
  for select using (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "customers_insert_tickets" on public.support_tickets;
create policy "customers_insert_tickets" on public.support_tickets
  for insert with check (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
  );

-- These four looked up profiles by primary key, so they never raised 21000. The new form
-- means the same and matches the others.
drop policy if exists "measurement_agent_profiles_owner_select" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_owner_select" on public.measurement_agent_profiles
  for select to authenticated using (
    profile_id in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "measurement_agent_profiles_owner_insert" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_owner_insert" on public.measurement_agent_profiles
  for insert to authenticated with check (
    profile_id in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "transporter_profiles_owner_select" on public.transporter_profiles;
create policy "transporter_profiles_owner_select" on public.transporter_profiles
  for select to authenticated using (
    profile_id in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "transporter_profiles_owner_insert" on public.transporter_profiles;
create policy "transporter_profiles_owner_insert" on public.transporter_profiles
  for insert to authenticated with check (
    profile_id in (select id from public.profiles where user_id = (select auth.uid()))
  );
