-- Backfill: booking 8b67a422-02e0-4dae-83dc-dc9f59669538's deposit_20 payment
-- (dda15f75-c53a-4282-acba-56647602c316) was marked paid by the paystack-webhook
-- function on 2026-06-15, but the corresponding payouts row was never created —
-- createPayoutRecord() silently failed/no-opped for an as-yet-undetermined
-- reason (DB-level testing showed the same insert succeeds cleanly outside the
-- edge function, so the cause is in the function runtime, not the schema).
-- This caused /admin/payouts to show no data despite a paid deposit.
--
-- Commission: booking total_price 250.00 ZAR * fx_rates.rate_to_usd 0.054 =
-- 13.50 USD, which falls in the 0-500 USD tier (12%) per
-- platform_commission_config. gross 50.00 -> commission 6.00 -> net 44.00.
-- eligible_after is set to paid_at + 48h (refund window), matching the
-- deposit_20 rule in createPayoutRecord().

insert into public.payouts (
  booking_id, operator_id, payment_id, payout_stage, stage,
  gross_amount, commission_rate, commission_amount, platform_fee, net_amount,
  status, eligible_after
)
select
  b.id,
  c.operator_id,
  p.id,
  'deposit_release',
  'deposit_20',
  p.amount,
  0.12,
  6.00,
  6.00,
  44.00,
  'pending',
  p.paid_at + interval '48 hours'
from public.payments p
join public.bookings b on b.id = p.booking_id
join public.containers c on c.id = b.container_id
where p.id = 'dda15f75-c53a-4282-acba-56647602c316'
  and p.status = 'paid'
on conflict (payment_id) do nothing;
