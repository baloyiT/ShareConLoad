-- Reserve container capacity server-side on booking insert.
--
-- Background: the booking UI updated containers.available_capacity_cbm / status
-- from the client, but `containers` RLS only allows the owning operator/admin to
-- UPDATE. Customer- and agent-initiated bookings therefore never reserved capacity
-- (silent RLS no-op): LCL under-decremented, FCL never went `full`. This trigger
-- performs the reservation as a SECURITY DEFINER function (table owner → bypasses
-- RLS), so it works regardless of who inserts the booking.

create or replace function public.apply_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_load_type text;
  c_available numeric;
begin
  select load_type, available_capacity_cbm
    into c_load_type, c_available
  from containers
  where id = NEW.container_id;

  -- Allowed container status values are ('open','closed','in_transit','delivered');
  -- a fully-booked container becomes 'closed' (the public listing RLS shows only 'open').
  if c_load_type = 'FCL' then
    -- FCL: one booking consumes the whole container.
    update containers
      set available_capacity_cbm = 0,
          status = 'closed'
    where id = NEW.container_id;
  else
    -- LCL: decrement by the booked CBM, floor at 0, close when exhausted.
    update containers
      set available_capacity_cbm = greatest(c_available - coalesce(NEW.total_cbm, 0), 0),
          status = case when c_available - coalesce(NEW.total_cbm, 0) <= 0 then 'closed' else status end
    where id = NEW.container_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_apply_booking_capacity on bookings;
create trigger trg_apply_booking_capacity
  after insert on bookings
  for each row execute function public.apply_booking_capacity();
