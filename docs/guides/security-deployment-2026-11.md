# Security deployment, November 2026

**Project:** ShareConLoad (`fkhfbifgvebygafsewot`)
**Purpose:** Deploy the Edge Function security fixes from Task S safely, in order.

Paystack is on LIVE keys. Migrations `_80` to `_83` are already applied. Everything below is still to do.

## Rules

- Deploy one function at a time, by name. **Never run a bulk deploy** (`supabase functions deploy` with no name). There is no `supabase/config.toml`, so a bulk deploy turns `verify_jwt` on for every function.
- **Never redeploy `paystack-webhook` without `--no-verify-jwt`.** Paystack sends no JWT, so every webhook would be refused and payments would stop being recorded. It has no change in this release: do not deploy it at all.
- Every function needs `supabase/functions/_shared/` with it. The CLI bundles it automatically. If deploying with the MCP tool, include `../_shared/auth.ts` and `../_shared/payments.ts` in the files.
- Do not enable `pg_net`. See "Scheduled payouts" below.

## `verify_jwt` values

Keep what is deployed today.

| Function | verify_jwt | CLI command |
|---|---|---|
| process-refund | true | `supabase functions deploy process-refund` |
| trigger-payout | true | `supabase functions deploy trigger-payout` |
| finalize-transfer | true | `supabase functions deploy finalize-transfer` |
| trigger-measurement-agent-payout | true | `supabase functions deploy trigger-measurement-agent-payout` |
| create-transfer-recipient | true | `supabase functions deploy create-transfer-recipient` |
| get-banks | true | `supabase functions deploy get-banks` |
| resolve-bank-account | true | `supabase functions deploy resolve-bank-account` |
| initialize-payment | true | `supabase functions deploy initialize-payment` |
| verify-measurement-payment | false | `supabase functions deploy verify-measurement-payment --no-verify-jwt` |
| auto-trigger-payouts | false | `supabase functions deploy auto-trigger-payouts --no-verify-jwt` |
| send-email | false | `supabase functions deploy send-email --no-verify-jwt` |
| verify-payment | false | `supabase functions deploy verify-payment --no-verify-jwt` |

Not changed in this release, so do not deploy. If one is ever redeployed, keep these values:

| Function | verify_jwt |
|---|---|
| paystack-webhook | false |
| initialize-measurement-payment | false |
| generate-agreement-pdf | true |

Never deployed, and **leave them undeployed**: `trigger-transporter-payout`, `verify-pickup-payment`, `initialize-pickup-payment`. The pickup service is not live, there are no pickup jobs, and transporter payouts have no admin screen yet. Deploy all three together when pickup goes live, with `verify_jwt` true.

## Before you start

1. Note the current `version` of each function from `list_edge_functions`, or the Functions page in the Supabase dashboard.
2. **Confirm the webhook URL.** In the Paystack dashboard, on the live keys, check that the webhook URL is exactly:

   `https://fkhfbifgvebygafsewot.supabase.co/functions/v1/paystack-webhook`

   This must be right before `verify-payment` goes out in Stage 3. The new `verify-payment` will not record a payment for a customer who returns with no session, or whose reference was replaced by a later attempt, so the webhook becomes the only thing that records those payments.

## Confirm a version is live

After each deploy, check that `version` rose in `list_edge_functions` compared with the number you noted, and that `verify_jwt` matches the table. **Do not run a check against a function until its version has risen.** The old code has no caller checks, so the same request against it would really run.

## Stage 1: deploy now

None of these depends on the frontend. Deploy each with the command above, in this order:

1. `process-refund`
2. `trigger-payout`
3. `finalize-transfer`
4. `trigger-measurement-agent-payout`
5. `create-transfer-recipient`
6. `get-banks`
7. `resolve-bank-account`
8. `verify-measurement-payment`
9. `auto-trigger-payouts`

`auto-trigger-payouts` returns 401 to everyone until Stage 2. That is the safe state.

## Stage 2: create the two secrets

Generate one random value of at least 32 characters and use it for both.

1. Edge Function secret `AUTO_PAYOUT_CRON_SECRET`: Supabase dashboard, Edge Functions, Secrets.
2. Vault secret `auto_payout_cron_secret`: Supabase dashboard, Vault, or `select vault.create_secret('<value>', 'auto_payout_cron_secret');`

## Stage 3: frontend, then the rest

The order matters. The old frontend sends `html` to `send-email`, which the new function refuses, and it shows "Payment Failed" for answers the new `verify-payment` gives.

1. Deploy the frontend to Vercel. It works with the old functions.
2. Confirm the production deployment is live.
3. Deploy `send-email`.
4. Check again that the Paystack webhook URL is right, then deploy `verify-payment`.
5. Deploy `initialize-payment`.

## Checks

Base URL: `https://fkhfbifgvebygafsewot.supabase.co/functions/v1/`

All requests are POST with `Content-Type: application/json` and `apikey: <anon key>`. `<nil>` is `00000000-0000-0000-0000-000000000000`, which matches no row, so nothing can reach Paystack.

Use each `Authorization: Bearer` value in turn: the anon key, then a customer's access token, then an admin's access token.

| Function | Body | Anon key | Customer | Admin |
|---|---|---|---|---|
| process-refund | `{"paymentId":"<nil>"}` | 401 | 403 | 404 |
| trigger-payout | `{"payoutId":"<nil>"}` | 401 | 403 | 404 |
| finalize-transfer | `{}` | 401 | 403 | 400 |
| trigger-measurement-agent-payout | `{"jobId":"<nil>"}` | 401 | 403 | 404 |
| create-transfer-recipient | `{"operatorProfileId":"<nil>","bankAccountName":"x","bankCountry":"Nowhere"}` | 401 | 403 | 403 |
| verify-measurement-payment | `{"reference":"none"}` | 401 | 404 | 404 |
| get-banks | `{"country":"Nowhere"}` | 401 | 200, `manual:true` | 200 |
| resolve-bank-account | `{}` | 401 | 400 | 400 |
| auto-trigger-payouts | `{}` | 401 | 401 | 401 |
| verify-payment | `{"reference":"none"}` | 401 | 200, `confirming:true` | 200, `confirming:true` |
| send-email | `{"to":"x@example.invalid","subject":"t"}` | 403 | 403 | do not run: it sends |

The admin results of 404 and 400 are the positive checks: they prove a real admin gets past the gate.

Then check by hand:

- `/admin/payouts` and `/admin/bookings` load for an admin.
- A signed-in user receives a notification email.
- A customer can start a payment and reach the Paystack page. Stop there unless a real payment is intended.

## Finalising a transfer with an OTP

The live Paystack account has OTP for transfers switched on, so `trigger-payout` only starts a transfer. There is no screen for this step yet.

1. Trigger the payout on `/admin/payouts`. The row shows `processing` and its transfer code (`TRF_...`).
2. Paystack sends the OTP to the account's registered email or phone.
3. Sign in to the site as an admin. Copy the access token from the browser: Application tab, the `sb-fkhfbifgvebygafsewot-auth-token` entry, `access_token`. Treat it like a password, and don't paste it into anything shared.
4. Send it:

   ```bash
   curl -X POST https://fkhfbifgvebygafsewot.supabase.co/functions/v1/finalize-transfer \
     -H "Authorization: Bearer <admin access token>" \
     -H "apikey: <anon key>" \
     -H "Content-Type: application/json" \
     -d '{"transferCode":"TRF_xxx","otp":"123456"}'
   ```

5. A good answer is `{"success":true,...}`. The `transfer.success` webhook then marks the payout `completed`.

The anon key or service role key will not work here: only a signed-in admin's token.

## Retrying a failed payout

Each payout has a stable Paystack reference, so a repeat of the same payout is refused by Paystack.

- **Operator payouts:** a payout shows `failed` only after Paystack's signed `transfer.failed` event. Use **Retry** on `/admin/payouts`. It makes a new attempt with a new reference. Only `failed` payouts can be retried this way.
- **A payout stuck on `processing`:** do not force it. Check the transfer in the Paystack dashboard first.
- **Measurement agent payouts:** no screen and no failed status. Check the Paystack dashboard shows the transfer failed, then call the function as an admin with `{"jobId":"...","retryAttempt":1}`, raising the number for each further attempt.

## Scheduled payouts

`pg_net` is not installed, so the `auto-trigger-payouts-daily` job fails every day and has never reached the function. Enabling `pg_net` after Stage 2 would start automatic payouts with live money, so it is a separate decision. With OTP on, those transfers would also wait for an OTP.

## If something goes wrong

Redeploy the previous version of that function from the last commit before Task S, with the same flag. The caller checks are lost until it is fixed, so do it only for a function that is blocking real customers. The migrations don't need reverting: they work with both old and new functions.
