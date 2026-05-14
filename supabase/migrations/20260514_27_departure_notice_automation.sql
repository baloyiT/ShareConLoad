-- ─── 1. Enable pg_cron ───────────────────────────────────────────────────────
create extension if not exists pg_cron;

-- ─── 2. Auto-fire departure notices at T-7 days ──────────────────────────────
-- Runs daily via cron. Finds containers whose departure_date falls within the
-- next 7 days and departure_notice_sent_at is still null, marks the column,
-- and inserts a notification row for each confirmed/loaded booking customer.

create or replace function public.fire_departure_notices()
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  v_container record;
  v_booking   record;
  v_route     text;
begin
  for v_container in
    select id, origin_city, destination_city, departure_date
    from public.containers
    where departure_notice_sent_at is null
      and departure_date::date >= current_date
      and departure_date::date <= (current_date + interval '7 days')::date
      and status not in ('delivered', 'closed')
  loop
    update public.containers
    set departure_notice_sent_at = now()
    where id = v_container.id;

    v_route := v_container.origin_city || ' → ' || v_container.destination_city;

    for v_booking in
      select id, customer_id
      from public.bookings
      where container_id = v_container.id
        and status in ('confirmed', 'loaded')
    loop
      insert into public.notifications (recipient_id, event, title, body, metadata)
      values (
        v_booking.customer_id,
        'container.departure_notice',
        'Departure in 7 Days — Payment Due',
        'Your container on ' || v_route || ' departs on ' ||
          to_char(v_container.departure_date::date, 'DD Mon YYYY') ||
          '. Please complete your 50% pre-departure payment to ensure your cargo is loaded.',
        jsonb_build_object(
          'bookingId',     v_booking.id,
          'recipientId',   v_booking.customer_id,
          'route',         v_route,
          'departureDate', v_container.departure_date
        )
      );
    end loop;
  end loop;
end;
$$;

-- Schedule: run daily at 06:00 UTC. Idempotent — unschedule first if exists.
do $$ begin
  perform cron.unschedule('fire-departure-notices-daily');
exception when others then null;
end $$;

select cron.schedule(
  'fire-departure-notices-daily',
  '0 6 * * *',
  $$select public.fire_departure_notices()$$
);

-- ─── 3. Departure date change notification trigger ────────────────────────────
-- Fires when an operator updates departure_date on a container.
-- Notifies all pending/confirmed/loaded booking customers of the new date.

create or replace function public.notify_departure_date_changed()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_route   text;
begin
  if NEW.departure_date = OLD.departure_date then
    return NEW;
  end if;

  v_route := NEW.origin_city || ' → ' || NEW.destination_city;

  for v_booking in
    select id, customer_id
    from public.bookings
    where container_id = NEW.id
      and status in ('pending', 'confirmed', 'loaded')
  loop
    insert into public.notifications (recipient_id, event, title, body, metadata)
    values (
      v_booking.customer_id,
      'container.departure_date_changed',
      'Departure Date Updated',
      'The departure date for your shipment on ' || v_route || ' has been updated to ' ||
        to_char(NEW.departure_date::date, 'DD Mon YYYY') || '. Please update your plans accordingly.',
      jsonb_build_object(
        'bookingId',        v_booking.id,
        'recipientId',      v_booking.customer_id,
        'route',            v_route,
        'oldDepartureDate', OLD.departure_date,
        'newDepartureDate', NEW.departure_date
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_departure_date_changed on public.containers;
create trigger trg_departure_date_changed
  after update of departure_date on public.containers
  for each row execute procedure public.notify_departure_date_changed();
