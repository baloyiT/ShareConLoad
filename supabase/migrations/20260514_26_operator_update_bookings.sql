-- Operators can update bookings on containers they own.
-- Required for booking confirmation and status progression (pending → confirmed → loaded → …).

drop policy if exists "operators_update_bookings_on_their_containers" on public.bookings;
create policy "operators_update_bookings_on_their_containers" on public.bookings
  for update
  using (
    exists (
      select 1 from public.containers
      where containers.id = bookings.container_id
        and containers.operator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.containers
      where containers.id = bookings.container_id
        and containers.operator_id = auth.uid()
    )
  );
