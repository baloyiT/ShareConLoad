-- Fix payout schema gaps that caused trigger-payout and paystack-webhook to
-- silently fail. The payouts table was missing several columns referenced by
-- both edge functions. Migration _28_payout_system_fixes attempted to add a
-- UNIQUE constraint on a non-existent payment_id column, which caused that
-- entire migration to fail (rolling back eligible_after and enum additions too).

-- 1. Enum values (migration _28_ rollback may have removed these)
do $$ begin
  alter type public.payout_status add value if not exists 'processing';
exception when others then null; end $$;

do $$ begin
  alter type public.payout_status add value if not exists 'completed';
exception when others then null; end $$;

-- 2. eligible_after: refund hold window (may have been rolled back with migration _28_)
alter table public.payouts
  add column if not exists eligible_after timestamptz default null;

-- 3. payment_id: links payout to its source payment record (webhook idempotency key)
alter table public.payouts
  add column if not exists payment_id uuid references public.payments(id) on delete set null;

-- 4. payout_stage: descriptive stage label written by paystack-webhook
--    e.g. 'deposit_release', 'departure_release', 'final_release'
alter table public.payouts
  add column if not exists payout_stage text;

-- 5. platform_fee: commission retained by the platform; written by trigger-payout
--    Mirrors commission_amount but stored separately for reporting.
alter table public.payouts
  add column if not exists platform_fee numeric(12,2);

-- 6. metadata: admin override payload written by trigger-payout on force-trigger
--    Contains: overridden, override_reason, overridden_by, overridden_at
alter table public.payouts
  add column if not exists metadata jsonb;

-- 7. Unique constraint on payment_id (idempotency guard for webhook upserts)
--    Now safe to add because payment_id column exists above.
alter table public.payouts
  drop constraint if exists payouts_payment_id_unique;

alter table public.payouts
  add constraint payouts_payment_id_unique unique (payment_id);

-- 8. Re-run backfill for booking 8b67a422 deposit payout (migration _68_ also
--    failed because payment_id column was missing at the time it ran).
--    Uses not exists guard instead of on conflict so it works even if the
--    unique constraint was somehow partially applied on a different DB state.
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
  and not exists (
    select 1 from public.payouts where payment_id = p.id
  );
