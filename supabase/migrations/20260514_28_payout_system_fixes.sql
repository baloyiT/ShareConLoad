-- 1. Add status values used by trigger-payout and paystack-webhook
--    (payout_status enum currently only has pending/on_hold/released/failed/reversed)
alter type public.payout_status add value if not exists 'processing';
alter type public.payout_status add value if not exists 'completed';

-- 2. Refund hold window: eligible_after is null (eligible now) or a future timestamp
--    (48h from payment for deposit_20; null for all other stages)
alter table public.payouts
  add column if not exists eligible_after timestamptz default null;

-- 3. Prevent duplicate payout records for the same payment (idempotency guard)
alter table public.payouts
  drop constraint if exists payouts_payment_id_unique;
alter table public.payouts
  add constraint payouts_payment_id_unique unique (payment_id);
