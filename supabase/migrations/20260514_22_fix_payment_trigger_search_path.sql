-- Fix payment_stage cast: with set search_path = '', enum types must be
-- fully schema-qualified as public.payment_stage.

create or replace function generate_payment_schedule()
returns trigger language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payments (booking_id, payer_id, payment_stage, stage, amount, currency, due_date)
  values
    (NEW.id, NEW.customer_id, 'deposit_20'::public.payment_stage,       'deposit_20'::public.payment_stage,       round((NEW.total_price * 0.20)::numeric, 2), 'ZAR', now() + interval '24 hours'),
    (NEW.id, NEW.customer_id, 'pre_departure_50'::public.payment_stage, 'pre_departure_50'::public.payment_stage, round((NEW.total_price * 0.50)::numeric, 2), 'ZAR', null),
    (NEW.id, NEW.customer_id, 'final_release_30'::public.payment_stage, 'final_release_30'::public.payment_stage, round((NEW.total_price * 0.30)::numeric, 2), 'ZAR', null);
  return NEW;
end;
$$;
