-- Security fix: "authenticated_insert_own_payments" let a customer insert a payments row for
-- their own booking with any status and amount, including 'paid'.
--
-- Nothing needs it. generate_payment_schedule is SECURITY DEFINER and owned by the table owner,
-- so it bypasses RLS, and no app code inserts into payments. Edge Functions use the service role.
drop policy if exists "authenticated_insert_own_payments" on public.payments;

-- One row per staged payment per booking. Limited to the three stages because the stage enum
-- also holds refund, chargeback and manual_adjustment, which may repeat.
create unique index if not exists payments_booking_stage_unique
  on public.payments (booking_id, stage)
  where stage in ('deposit_20', 'pre_departure_50', 'final_release_30');

-- verify-payment finds the payment by its reference.
create unique index if not exists payments_paystack_reference_unique
  on public.payments (paystack_reference)
  where paystack_reference is not null;
