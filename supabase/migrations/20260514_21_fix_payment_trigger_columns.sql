-- Fix generate_payment_schedule trigger:
-- 1. Populate payer_id (NOT NULL, was missing)
-- 2. Populate payment_stage (NOT NULL, was missing — trigger only set 'stage')
-- 3. Fix currency default to 'ZAR' (was 'USD')
-- 4. Add set search_path = '' (Supabase security best practice for SECURITY DEFINER)
-- 5. Add INSERT policy so authenticated users can insert payments for their own bookings

alter table public.payments
  alter column currency set default 'ZAR';

create or replace function generate_payment_schedule()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payments (booking_id, payer_id, payment_stage, stage, amount, currency, due_date)
  values
    (NEW.id, NEW.customer_id, 'deposit_20'::payment_stage,       'deposit_20'::payment_stage,       round((NEW.total_price * 0.20)::numeric, 2), 'ZAR', now() + interval '24 hours'),
    (NEW.id, NEW.customer_id, 'pre_departure_50'::payment_stage, 'pre_departure_50'::payment_stage, round((NEW.total_price * 0.50)::numeric, 2), 'ZAR', null),
    (NEW.id, NEW.customer_id, 'final_release_30'::payment_stage, 'final_release_30'::payment_stage, round((NEW.total_price * 0.30)::numeric, 2), 'ZAR', null);
  return NEW;
end;
$$;

drop trigger if exists trg_generate_payment_schedule on public.bookings;

create trigger trg_generate_payment_schedule
  after insert on public.bookings
  for each row execute procedure generate_payment_schedule();

-- Allow authenticated users to insert payment records for their own bookings.
-- This is required because the SECURITY DEFINER trigger runs within the
-- authenticated session context and needs an explicit INSERT policy.
drop policy if exists "authenticated_insert_own_payments" on public.payments;
create policy "authenticated_insert_own_payments" on public.payments
  for insert with check (
    booking_id in (
      select id from public.bookings where customer_id = auth.uid()
    )
  );
