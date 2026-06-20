# Operator Payout — Automated & Manual Trigger Design

**Date:** 2026-06-20
**Status:** Approved

---

## Overview

Two independent trigger paths both execute a Paystack transfer and update the payout record:

- **Manual** — admin clicks "Trigger →" on `/admin/payouts` (existing, unchanged)
- **Automated** — pg_cron fires daily at 06:00 UTC, calls a new `auto-trigger-payouts` edge function that processes all eligible pending payouts in one batch

---

## Architecture

```
MANUAL (existing, unchanged)
  Admin clicks "Trigger →"
    → trigger-payout edge function
      → Paystack /transfer
      → payout: status = 'processing', transfer_code stored
      → audit_log: payout.triggered

AUTOMATED (new)
  pg_cron daily @ 06:00 UTC
    → pg_net HTTP POST → auto-trigger-payouts edge function
      → find all eligible pending payouts (single query)
      → load platform_commission_config once
      → for each eligible payout:
          → calculate commission + net amount
          → Paystack /transfer
          → payout: status = 'processing', metadata.auto_triggered = true
      → audit_log: payout.auto_trigger_batch (single batch summary)
```

---

## Eligibility Rule

Same rule enforced by both paths:

```
payouts.status = 'pending'
AND (eligible_after IS NULL OR eligible_after < now())
AND operator_profiles.payout_enabled = true
AND operator_profiles.payout_hold = false
AND operator_profiles.paystack_recipient_code IS NOT NULL
AND operator_profiles.status IN ('active', 'trusted')
AND no active dispute on the booking
```

### Per-stage eligible_after

| Stage | eligible_after | Cron behaviour |
|---|---|---|
| deposit_release (20%) | `paid_at + 48h` | picked up the morning after the 48h refund window expires |
| departure_release (50%) | `NULL` | picked up on the next cron run after payment confirmed |
| final_release (30%) | `NULL` | picked up on the next cron run after payment confirmed |

---

## auto-trigger-payouts Edge Function

**File:** `supabase/functions/auto-trigger-payouts/index.ts`
**JWT verification:** disabled (`verify_jwt: false`) — called with service role key in Authorization header by pg_cron; same key accepted for manual test calls

### Execution flow

1. Query all eligible payouts (single JOIN across payouts, profiles, operator_profiles, disputes)
2. Load `platform_commission_config` once — shared across the batch
3. For each eligible payout:
   - Calculate commission rate (same tiered logic as `trigger-payout`)
   - POST to Paystack `/transfer`
   - **If Paystack succeeds:** update payout `status = 'processing'`, store `transfer_code`, `net_amount`, `commission_amount`, `platform_fee`, `commission_rate`, `metadata = { auto_triggered: true, triggered_at: <iso> }`
   - **If Paystack fails:** leave `status = 'pending'`, record error in batch result
4. Write one `audit_logs` entry with full batch summary

### Batch outcomes

| Result | Condition | Action |
|---|---|---|
| `triggered` | Paystack accepted transfer | status → `processing`, metadata stamped |
| `skipped` | Operator block (hold, disabled, no bank, compliance, dispute) | status unchanged, reason logged in batch |
| `failed` | Paystack returned error | status unchanged, error logged in batch |

Skipped and failed payouts remain `pending` — the next cron run or manual trigger will pick them up once the block is resolved.

### Batch audit log shape

```json
{
  "action":      "payout.auto_trigger_batch",
  "target_type": "batch",
  "metadata": {
    "triggered": 2,
    "skipped":   1,
    "failed":    0,
    "details": [
      { "payout_id": "...", "result": "triggered", "transfer_code": "TRF_xxx", "net_amount": 44.00 },
      { "payout_id": "...", "result": "skipped",   "reason": "payout_hold" },
      { "payout_id": "...", "result": "triggered", "transfer_code": "TRF_yyy", "net_amount": 120.00 }
    ]
  }
}
```

---

## pg_cron Scheduling

**Migration:** `20260620_70_auto_payout_cron.sql`

1. Store service role key as DB setting: `app.settings.service_role_key`
2. Create `public.auto_trigger_payouts_cron()` SQL function that calls the edge function via `pg_net.http_post`
3. Schedule: `cron.schedule('auto-trigger-payouts-daily', '0 6 * * *', ...)` — idempotent (unschedule first if exists)

```sql
select net.http_post(
  url     := 'https://fkhfbifgvebygafsewot.supabase.co/functions/v1/auto-trigger-payouts',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
  ),
  body    := '{}'::jsonb
);
```

---

## Admin UI Changes

One addition to `/admin/payouts` — a badge in the Status column to distinguish auto-triggered payouts:

```
processing   ⚙ Auto          ← triggered by cron
processing   ⚡ Overridden    ← admin force-triggered during refund window
processing                   ← admin triggered normally
```

The `⚙ Auto` badge reads `payout.metadata?.auto_triggered === true`.

All existing UI — "Trigger →" button, countdown timer, override modal — is unchanged.

---

## Deliverables

| # | What | File |
|---|---|---|
| 1 | New edge function | `supabase/functions/auto-trigger-payouts/index.ts` |
| 2 | pg_cron migration | `supabase/migrations/20260620_70_auto_payout_cron.sql` |
| 3 | Admin UI badge | `app/admin/payouts/page.tsx` |

---

## Testing Plan

**Precondition:** DB reset to clean state (only admin user `support@shareconload.com` remains).

### Setup
1. Register operator → complete onboarding (bank account registered via `create-transfer-recipient`)
2. Register customer
3. Create container
4. Customer creates booking → 3 payment records auto-generated by trigger

### Stage 1 — deposit_release (20%)
1. Customer pays deposit → `verify-payment` creates payout with `eligible_after = paid_at + 48h`
2. Call `auto-trigger-payouts` directly → payout **skipped** (still in refund window) ✓
3. SQL fast-forward: `update public.payouts set eligible_after = now() - interval '1 minute' where stage = 'deposit_20'`
4. Call `auto-trigger-payouts` again → payout **triggered**, status → `processing`, `⚙ Auto` badge visible ✓
5. Simulate Paystack `transfer.success` webhook → status → `completed` ✓

### Stage 2 — departure_release (50%)
1. Customer pays pre-departure → payout created with `eligible_after = NULL`
2. Call `auto-trigger-payouts` → payout **triggered** immediately (no window) ✓

### Stage 3 — final_release (30%)
1. Customer pays final → payout created with `eligible_after = NULL`
2. Call `auto-trigger-payouts` → payout **triggered** ✓

### Manual trigger (parallel verification)
- Payout `pending` + window expired → admin clicks "Trigger →" → works as before ✓
- Payout already `processing` → "Trigger →" disabled ✓

### Audit log verification
- After each `auto-trigger-payouts` call, `audit_logs` contains a `payout.auto_trigger_batch` entry with correct triggered/skipped/failed counts ✓
