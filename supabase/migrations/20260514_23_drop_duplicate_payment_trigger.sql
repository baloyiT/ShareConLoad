-- Remove the duplicate payment schedule trigger that was firing alongside
-- trg_generate_payment_schedule, causing 6 payment records per booking instead of 3.

drop trigger if exists trg_create_initial_payment_schedule on public.bookings;
drop function if exists create_initial_payment_schedule();

-- Backfill stage from payment_stage for any records where stage is null
-- (created by the now-removed old trigger).
update public.payments
set stage = payment_stage
where stage is null and payment_stage is not null;
