# Paystack Go-Live Guide

**Project:** ShareConLoad  
**Date:** June 2026  
**Purpose:** Switch the platform from Paystack test mode to live mode for real money transactions.

> **No code changes are required.** All Paystack API calls run inside Supabase Edge Functions.  
> The only change is swapping the secret key in Supabase and registering your webhook on the live dashboard.

---

## Prerequisites

Before starting, make sure you have:

- [ ] Access to your Paystack dashboard (paystack.com)
- [ ] Access to your Supabase dashboard (supabase.com) or the Supabase CLI installed
- [ ] Your Supabase project ref: `fkhfbifgvebygafsewot`
- [ ] Business KYC documents ready (if not already verified)

---

## Step 1 — Complete Paystack Business Verification

Paystack requires identity and business verification before activating live mode.

1. Log in to [https://dashboard.paystack.com](https://dashboard.paystack.com)
2. Click your business name in the top-right corner → **Settings**
3. Go to the **Compliance** tab
4. Complete all required sections:
   - Business information (name, type, address)
   - Bank account details (for receiving payouts)
   - Identity verification (director ID, CAC documents for South African businesses)
5. Submit and wait for Paystack to approve — this typically takes 1–3 business days
6. You will receive an email when your account is activated for live transactions

> You can proceed to Steps 2–5 before verification is complete, but live transactions will not work until Paystack approves your account.

---

## Step 2 — Get Your Live Secret Key

1. In the Paystack dashboard, locate the **mode toggle** at the top of the page
2. Switch from **Test** to **Live**
3. Go to **Settings** → **API Keys & Webhooks**
4. Copy the **Live Secret Key** — it starts with `sk_live_`

> Keep this key private. Never commit it to code or share it. It goes directly into Supabase secrets only.

---

## Step 3 — Update the Supabase Edge Function Secret

This is the only technical step. The secret key is stored in Supabase and used by all three payment Edge Functions at runtime.

### Option A — Via Supabase Dashboard (recommended)

1. Go to [https://supabase.com/dashboard/project/fkhfbifgvebygafsewot/settings/functions](https://supabase.com/dashboard/project/fkhfbifgvebygafsewot/settings/functions)
2. Click **Edit secrets**
3. Find the row named `PAYSTACK_SECRET_KEY`
4. Replace the existing value (`sk_test_...`) with your live key (`sk_live_...`)
5. Click **Save**

### Option B — Via Supabase CLI

If you have the Supabase CLI installed and are logged in:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx \
  --project-ref fkhfbifgvebygafsewot
```

Confirm it was set:

```bash
supabase secrets list --project-ref fkhfbifgvebygafsewot
```

You should see `PAYSTACK_SECRET_KEY` listed (the value is hidden for security).

> No redeployment of Edge Functions is needed — secrets are injected at invocation time.

---

## Step 4 — Register Your Webhook on the Live Dashboard

The Paystack webhook notifies your platform when payments are confirmed. You must register the URL on the **live** dashboard separately from the test dashboard.

1. In the Paystack dashboard (make sure you are in **Live** mode)
2. Go to **Settings** → **API Keys & Webhooks**
3. Scroll to the **Webhook URL** section
4. Enter your webhook URL:

```
https://fkhfbifgvebygafsewot.supabase.co/functions/v1/paystack-webhook
```

5. Click **Update** to save

> This is the same URL as your test webhook — it is the live Paystack dashboard that determines whether test or live events are sent.

---

## Step 5 — Verify ZAR Currency is Enabled

ShareConLoad processes payments in South African Rand (ZAR). Confirm this is enabled on your live account.

1. In the Paystack dashboard (Live mode), go to **Settings** → **Preferences**
2. Check that **South Africa (ZAR)** is listed as an active currency
3. If it is not listed, contact Paystack support at [support@paystack.com](mailto:support@paystack.com) to enable ZAR for your live account

---

## Step 6 — Do a Live Test Transaction

Before going fully live, run one real transaction end-to-end to confirm everything works.

1. Create a real booking on the platform as a shipper
2. Proceed to the payment page (Stage 1 — 20% deposit)
3. Complete payment with a real card and a small amount
4. Confirm in the Paystack live dashboard that the transaction appears under **Transactions**
5. Confirm in your Supabase database that:
   - `payments.status` changed to `paid`
   - `bookings.status` advanced correctly
   - A notification was created for the admin

If the transaction succeeds end-to-end, the platform is live.

---

## Step 7 — Operator Payout Setup (for each operator)

For operators to receive payouts, their bank account must be registered with Paystack on the **live** account.

1. Each operator must complete the **Operator Onboarding** flow (if not already done)
2. The `create-transfer-recipient` Edge Function registers their bank with Paystack and stores a `paystack_recipient_code` on their profile
3. In the **Admin** panel → **Operators**, confirm each operator has:
   - `payout_enabled = true`
   - `payout_hold = false`
   - A `paystack_recipient_code` set

> Transfer recipients created during test mode are **not** valid in live mode. Operators may need to re-submit their bank details after the switch.

---

## Rollback — Switching Back to Test Mode

If you need to revert to test mode:

1. Replace `PAYSTACK_SECRET_KEY` in Supabase with your test key (`sk_test_...`) following the same steps as Step 3
2. No other changes are needed

---

## Summary Checklist

| Step | Action | Done |
|------|--------|------|
| 1 | Complete Paystack business verification | [ ] |
| 2 | Copy Live Secret Key from Paystack dashboard | [ ] |
| 3 | Update `PAYSTACK_SECRET_KEY` in Supabase secrets | [ ] |
| 4 | Register webhook URL on Paystack live dashboard | [ ] |
| 5 | Confirm ZAR currency is enabled | [ ] |
| 6 | Run a live test transaction end-to-end | [ ] |
| 7 | Verify operator payout recipient codes are live | [ ] |

---

## Support Contacts

| Service | Contact |
|---------|---------|
| Paystack support | [support@paystack.com](mailto:support@paystack.com) |
| Paystack docs | [https://paystack.com/docs](https://paystack.com/docs) |
| ShareConLoad platform support | [support@shareconload.com](mailto:support@shareconload.com) |
| Supabase support | [https://supabase.com/support](https://supabase.com/support) |
