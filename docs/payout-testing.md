# Payout Testing Guide — ShareConLoad

## Environment

| Item | Value |
|------|-------|
| Mode | **Test** (Paystack test keys only) |
| Currency | ZAR |
| Supabase project | fkhfbifgvebygafsewot |
| Admin URL | `/admin/payouts` |
| Operator URL | `/operator/payouts` |

---

## Commission Rates (default — tiered)

| Shipment Value | Rate | Example: R10 000 gross |
|---|---|---|
| R0 – R5 000 | 12% | — |
| R5 001 – R20 000 | **10%** | R1 000 commission → R9 000 net |
| R20 001 – R50 000 | 8% | — |
| R50 001+ | 6% | — |

Rates are DB-driven. Admin can change them at `/admin/commission`.

---

## Prerequisites Checklist

Before running any payout test, confirm all of the following:

### 1 — Paystack test mode
```sql
-- Nothing to check in DB, but confirm the secret starts with sk_test_
-- Supabase Dashboard → Edge Functions → Secrets → PAYSTACK_SECRET_KEY
```

### 2 — Operator has a bank account registered
```sql
select
  op.legal_name,
  op.payout_enabled,
  op.payout_hold,
  op.paystack_recipient_code
from operator_profiles op;
```
- `paystack_recipient_code` must not be null
- If null: operator must complete `/onboarding/operator` → Register Bank Account
- In test mode Paystack accepts any valid-format account number

### 3 — Admin has enabled payouts for the operator
```sql
update operator_profiles
set payout_enabled = true, payout_hold = false
where legal_name = '<operator name>';
```
Or toggle via `/admin/operators`.

### 4 — At least one confirmed booking with payments
```sql
select b.id, b.status, b.total_price, p.stage, p.status as pay_status, p.amount
from bookings b
join payments p on p.booking_id = b.id
order by b.created_at desc;
```

---

## Test Scenario 1 — Stage 1 Deposit Payout (20%)

### Setup
Use test card `4084 0840 8408 4081` (any future expiry, CVV `408`).

### Steps

| # | Action | Where |
|---|--------|-------|
| 1 | Make a booking | `/booking/<containerId>` |
| 2 | Pay Stage 1 (20% deposit) with test card | `/payments/<bookingId>` |
| 3 | After Paystack redirect, callback page verifies payment | `/payments/callback` |
| 4 | Check payout record created | SQL or `/admin/payouts` |
| 5 | Confirm button is **disabled** (48h refund window) | `/admin/payouts` |
| 6 | Skip refund window (SQL below) | Supabase SQL editor |
| 7 | Click **Trigger →** | `/admin/payouts` |
| 8 | Status changes to `processing`, transfer code appears | `/admin/payouts` |
| 9 | Simulate webhook (SQL below) or wait for Paystack | — |
| 10 | Status changes to `completed` | `/admin/payouts` |

### SQL — Verify payout record created
```sql
select
  py.id,
  py.stage,
  py.gross_amount,
  py.commission_rate,
  py.commission_amount,
  py.net_amount,
  py.status,
  py.eligible_after,
  py.paystack_transfer_code
from payouts py
order by py.created_at desc
limit 5;
```

### SQL — Skip the 48h refund window
```sql
update payouts
set eligible_after = null
where status = 'pending'
  and eligible_after is not null;
```

### SQL — Simulate transfer.success webhook
```sql
update payouts
set status = 'completed',
    completed_at = now()
where status = 'processing';
```

### Expected commission on a R5 000 deposit (20% of R25 000 booking)
| Field | Value |
|---|---|
| Gross | R5 000.00 |
| Commission rate | 12% (R0–R5 000 tier) |
| Commission | R600.00 |
| Net | R4 400.00 |

---

## Test Scenario 2 — Stage 2 Pre-Departure Payout (50%)

Stage 2 has **no refund hold** — payouts are immediately triggerable.

### Unlock Stage 2 payment (all three conditions required)

**Condition A — Stage 1 paid** ✓ (from Scenario 1)

**Condition B — Booking status is `loaded`**
Operator goes to `/operator/bookings` → confirm booking → set status to `loaded`.
Or via SQL:
```sql
update bookings
set status = 'loaded'
where id = '<booking_id>';
```

**Condition C — Departure notice sent**
Operator clicks **Send Departure Notice** on `/operator` dashboard (7-day notice button).
Or via SQL:
```sql
update containers
set departure_notice_sent_at = now()
where id = '<container_id>';
```

### Steps

| # | Action | Where |
|---|--------|-------|
| 1 | Ensure Stage 1 is paid and conditions B+C are met | (above) |
| 2 | Pay Stage 2 (50%) with test card | `/payments/<bookingId>` |
| 3 | Verify payout record created (no eligible_after) | SQL |
| 4 | Click **Trigger →** immediately (no hold) | `/admin/payouts` |
| 5 | Simulate webhook | SQL |

### Expected commission on a R12 500 pre-departure (50% of R25 000 booking)
| Field | Value |
|---|---|
| Gross | R12 500.00 |
| Commission rate | 10% (R5 001–R20 000 tier) |
| Commission | R1 250.00 |
| Net | R11 250.00 |

---

## Test Scenario 3 — Stage 3 Final Release Payout (30%)

Stage 3 has **no refund hold** — payouts are immediately triggerable.

### Unlock Stage 3 payment

**Condition — `destination_arrival` milestone recorded**
Operator goes to `/operator/bookings` → Record Milestone → select `destination_arrival`.
Or via SQL:
```sql
insert into shipment_milestones (booking_id, milestone, recorded_at, recorded_by)
values ('<booking_id>', 'destination_arrival', now(), auth.uid());
```

### Steps

| # | Action | Where |
|---|--------|-------|
| 1 | Record destination_arrival milestone | `/operator/bookings` |
| 2 | Pay Stage 3 (30% final release) with test card | `/payments/<bookingId>` |
| 3 | Verify payout record created | SQL |
| 4 | Click **Trigger →** | `/admin/payouts` |
| 5 | Simulate webhook | SQL |

### Expected commission on a R7 500 final release (30% of R25 000 booking)
| Field | Value |
|---|---|
| Gross | R7 500.00 |
| Commission rate | 10% (R5 001–R20 000 tier) |
| Commission | R750.00 |
| Net | R6 750.00 |

---

## Test Scenario 4 — Payout Hold (operator blocked)

Verify that payouts are blocked when the operator is on hold.

```sql
update operator_profiles
set payout_hold = true
where legal_name = '<operator>';
```

Go to `/admin/payouts` → Trigger button should be disabled with reason "Operator on payout hold".

Reset:
```sql
update operator_profiles
set payout_hold = false
where legal_name = '<operator>';
```

---

## Test Scenario 5 — Active Dispute Blocks Payout

```sql
insert into disputes (booking_id, submitted_by, reason, description, status)
values ('<booking_id>', auth.uid(), 'damage', 'Test dispute', 'open');
```

Attempt to trigger payout → should return "Cannot pay out while an active dispute exists".

Resolve to unblock:
```sql
update disputes set status = 'resolved' where booking_id = '<booking_id>';
```

---

## Test Scenario 6 — Commission Config Change

1. Go to `/admin/commission`
2. Switch to **Fixed rate**, set to `5%`, save
3. Make a new payment
4. Verify the new payout record uses `commission_rate = 0.05`

```sql
select gross_amount, commission_rate, commission_amount, net_amount
from payouts
order by created_at desc
limit 1;
```

5. Switch back to **Tiered**, save

---

## Operator View Verification

After completing any payout test, verify the operator sees:

1. Go to `/operator/payouts`
2. Each payout card should show:
   - Stage label (e.g. `20% Deposit`)
   - Route
   - Net amount (large, coloured green when completed)
   - `Gross R… | Commission R… 12% | Date`
   - Transfer code (when processing/completed)

---

## Full Reset (wipe all test payouts)

```sql
-- Remove all test payout records
delete from payouts where status in ('pending', 'processing', 'failed');

-- Reset payment statuses back to pending for re-testing
update payments set status = 'pending', paid_at = null, paystack_reference = null
where booking_id = '<booking_id>';
```

---

## Common Failure Modes

| Error | Cause | Fix |
|---|---|---|
| "Payout record not found" | Wrong payoutId passed | Check the UUID in admin page |
| "Payouts are not enabled" | `payout_enabled = false` | Admin toggles at `/admin/operators` |
| "Operator has no registered bank account" | `paystack_recipient_code` is null | Complete operator bank onboarding |
| "Still in refund window — eligible in Xh" | Stage 1 within 48h of payment | Set `eligible_after = null` in SQL |
| "Cannot pay out while an active dispute exists" | Open dispute on the booking | Resolve dispute first |
| Trigger button disabled (no error) | `eligibilityReason()` returning a reason | Check commission display under button |
| Payout stays `processing` forever | Paystack webhook not firing in test mode | Use the SQL simulate command above |
