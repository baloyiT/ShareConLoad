-- Fix RLS policies that incorrectly compare bookings.customer_id to profiles.id.
-- bookings.customer_id stores auth.uid() directly, not profiles.id.

-- payments
drop policy if exists "customers_view_own_payments" on public.payments;
create policy "customers_view_own_payments" on public.payments
  for select using (
    booking_id in (select id from public.bookings where customer_id = auth.uid())
  );

-- shipment_milestones
drop policy if exists "customers_view_own_milestones" on public.shipment_milestones;
create policy "customers_view_own_milestones" on public.shipment_milestones
  for select using (
    booking_id in (select id from public.bookings where customer_id = auth.uid())
  );

-- customs_events
drop policy if exists "customers_view_customs_events" on public.customs_events;
create policy "customers_view_customs_events" on public.customs_events
  for select using (
    booking_id in (select id from public.bookings where customer_id = auth.uid())
  );

-- cargo_release_authorizations
drop policy if exists "customers_view_own_release" on public.cargo_release_authorizations;
create policy "customers_view_own_release" on public.cargo_release_authorizations
  for select using (
    booking_id in (select id from public.bookings where customer_id = auth.uid())
  );
