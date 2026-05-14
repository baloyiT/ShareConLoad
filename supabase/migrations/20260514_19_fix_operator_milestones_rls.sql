-- Fix operators_view_container_milestones: containers.operator_id stores auth.uid(),
-- not profiles.id, so the profiles subquery join is incorrect.

drop policy if exists "operators_view_container_milestones" on public.shipment_milestones;
create policy "operators_view_container_milestones" on public.shipment_milestones
  for select using (
    booking_id in (
      select b.id from public.bookings b
      join public.containers c on c.id = b.container_id
      where c.operator_id = auth.uid()
    )
  );
