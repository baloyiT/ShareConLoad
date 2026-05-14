# Payment Testing Guide — ShareConLoad

## Environment

| Item | Value |
|------|-------|
| Mode | **Test** (Paystack test keys) |
| Currency | ZAR |
| Project | fkhfbifgvebygafsewot (Supabase) |

---

## Prerequisites

1. Be logged in as a **customer** (not operator/admin)
2. Have at least one available container on the home page
3. Paystack test secret key set in Supabase Edge Function secrets

---

## Full Payment Flow

### Step 1 — Create a Booking

1. Go to the home page and open a container
2. Fill in the booking form (CBM, items, declaration)
3. Click **Submit Booking**
4. You are redirected to `/payments/<bookingId>`

**Expected:** 3 payment stage cards appear — Stage 1 (20%) is active, Stages 2 and 3 are locked.

---

### Step 2 — Pay Stage 1: 20% Deposit

1. Click **Pay R___ →** on the Stage 1 card
2. You are redirected to Paystack's hosted checkout
3. Enter the test card details below
4. Complete the payment

**Test Card:**

| Field | Value |
|-------|-------|
| Card number | `4084 0840 8408 4081` |
| Expiry | `12/29` (any future date) |
| CVV | `408` |
| PIN | `0000` |
| OTP | `123456` |

5. Paystack redirects you to `/payments/callback`
6. The callback page verifies the payment via the `verify-payment` Edge Function
7. After 3 seconds it redirects back to `/payments/<bookingId>`

**Expected:** Stage 1 shows **Confirmed** ✓ in green. Stage 2 (50%) is now unlocked and payable.

---

### Step 3 — Pay Stage 2: 50% Pre-Departure

1. Click **Pay R___ →** on the Stage 2 card
2. Repeat the Paystack checkout with the same test card
3. Return via callback

**Expected:** Stage 2 shows **Confirmed** ✓. Stage 3 (30%) is now unlocked.

---

### Step 4 — Pay Stage 3: 30% Final Release

1. Click **Pay R___ →** on the Stage 3 card
2. Complete checkout

**Expected:** All 3 stages show **Confirmed** ✓. The page shows:
> ✓ All payments complete. Your cargo release can be authorised once conditions are met.

---

## Verifying in Supabase

After each payment, confirm records are updated:

```sql
select stage, status, amount, paid_at
from public.payments
where booking_id = '<your-booking-id>'
order by payment_stage;
```

---

## Payment History

Navigate to `/payments/history` to see all payments across all bookings with status filters (All / Pending / Paid / Refunded).

---

## Webhook (Production)

The webhook provides a safety net if a user closes the tab before the callback fires. For local/test use the callback path is sufficient.

**Webhook URL:**
```
https://fkhfbifgvebygafsewot.supabase.co/functions/v1/paystack-webhook
```

**Register in Paystack Dashboard:** Settings → API Keys & Webhooks → Webhook URL

**Events to enable:**
- `charge.success`
- `transfer.success`
- `transfer.failed`
- `refund.processed`

---

## Switching to Production

1. Replace test key with live key in Supabase secrets:
   ```
   npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxx --project-ref fkhfbifgvebygafsewot
   ```
2. Register the webhook URL in the live Paystack dashboard
3. Update `SITE_URL` if domain changes

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `initialize-payment` | Creates Paystack transaction, returns `authorization_url` |
| `verify-payment` | Verifies reference with Paystack, marks payment as `paid` |
| `paystack-webhook` | Handles async Paystack events (redundancy) |
| `trigger-payout` | Admin-triggered operator payout after payment clears |
| `process-refund` | Admin-initiated refund via Paystack |

---

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| "Could not initialize payment" | `PAYSTACK_SECRET_KEY` not set | Run `supabase secrets set` command |
| "Payment not successful" | Test card declined | Use the exact test card numbers above |
| Callback stuck on "Verifying…" | `verify-payment` function error | Check Supabase Edge Function logs |
| No payment records on page | Booking trigger failed | Check `payments` table for the booking ID |
