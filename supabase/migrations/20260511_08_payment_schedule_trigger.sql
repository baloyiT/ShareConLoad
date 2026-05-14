-- supabase/migrations/20260511_08_payment_schedule_trigger.sql

create or replace function generate_payment_schedule()
returns trigger language plpgsql security definer as $$
begin
  insert into public.payments (booking_id, stage, amount, due_date)
  values
    (NEW.id, 'deposit_20',       NEW.total_price * 0.20, now() + interval '24 hours'),
    (NEW.id, 'pre_departure_50', NEW.total_price * 0.50, null),
    (NEW.id, 'final_release_30', NEW.total_price * 0.30, null);
  return NEW;
end;
$$;

drop trigger if exists trg_generate_payment_schedule on public.bookings;

create trigger trg_generate_payment_schedule
  after insert on public.bookings
  for each row execute procedure generate_payment_schedule();
