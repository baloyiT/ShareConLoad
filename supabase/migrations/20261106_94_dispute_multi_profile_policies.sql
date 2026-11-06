-- A user can have several profile rows, so `= (select ... profiles ...)` raised 21000
-- for them. These policies use IN. Admins keep their own admins_all_* policies.
-- The storage policies from _89 join on submitted_by and already cope with several rows.

drop policy if exists "customers_view_own_disputes" on public.disputes;
create policy "customers_view_own_disputes" on public.disputes
  for select using (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
  );

-- bookings.customer_id is the auth user id. The booking check stops a user opening a
-- dispute on a booking that is not theirs.
drop policy if exists "customers_insert_disputes" on public.disputes;
create policy "customers_insert_disputes" on public.disputes
  for insert with check (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
    and booking_id in (select id from public.bookings where customer_id = (select auth.uid()))
  );

drop policy if exists "dispute_parties_view_evidence" on public.dispute_evidence;
create policy "dispute_parties_view_evidence" on public.dispute_evidence
  for select using (
    dispute_id in (
      select d.id from public.disputes d
      join public.profiles p on p.id = d.submitted_by
      where p.user_id = (select auth.uid())
    )
  );

-- Also checks the dispute: before, any user could attach a row to any dispute.
drop policy if exists "dispute_parties_upload_evidence" on public.dispute_evidence;
create policy "dispute_parties_upload_evidence" on public.dispute_evidence
  for insert with check (
    uploaded_by in (select id from public.profiles where user_id = (select auth.uid()))
    and dispute_id in (
      select d.id from public.disputes d
      join public.profiles p on p.id = d.submitted_by
      where p.user_id = (select auth.uid())
    )
  );

drop policy if exists "customers_view_own_claims" on public.insurance_claims;
create policy "customers_view_own_claims" on public.insurance_claims
  for select using (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
  );

drop policy if exists "customers_insert_claims" on public.insurance_claims;
create policy "customers_insert_claims" on public.insurance_claims
  for insert with check (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
  );
