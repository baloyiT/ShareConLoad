# Draft Reply: Paystack Compliance Review

**To:** Grace Nnabugwu, Paystack  
**From:** Justice Baloyi, VEYQON GROUP (Pty) Ltd  
**Re:** ShareConLoad — Compliance Review Response  
**Date:** 2026-06-03

---

Dear Grace,

Thank you for your message and for reviewing the ShareConLoad application. We are happy to address each of your questions in detail below.

---

## 1. How Are Payments Handled?

ShareConLoad uses a staged payment model with three distinct payment events per booking. All Paystack API calls are routed exclusively through Supabase Edge Functions — no Paystack calls originate from the browser or frontend.

**Payment flow:**

1. The customer selects a container and submits a booking on the ShareConLoad platform.
2. The frontend calls our `initialize-payment` Edge Function (server-side), which uses the Paystack secret key (stored only in Supabase Edge Function secrets — never exposed as a `NEXT_PUBLIC_` variable) to create a Paystack transaction and returns an `authorization_url`.
3. The customer is redirected to the Paystack-hosted payment page to complete payment.
4. On return, our `verify-payment` Edge Function confirms payment status server-side before updating the booking.
5. Paystack sends webhook events to our `paystack-webhook` Edge Function, which handles all downstream status updates.
6. Operator payouts are triggered via our `trigger-payout` Edge Function using the Paystack Transfer API once eligibility conditions are met.
7. Any refunds are processed by an admin through the `process-refund` Edge Function.

**Three payment stages per booking:**

| Stage | Amount | When Due |
|---|---|---|
| Deposit | 20% of booking total | At booking creation — due within 24 hours |
| Pre-departure | 50% of booking total | 7 days before container departure |
| Final release | 30% of booking total | On cargo arrival — required before release to consignee |

Booking progression is blocked server-side if the required payment stage is not confirmed as `paid` before the next stage can be initiated.

**Operator payouts:**

Payouts are triggered per stage after the following conditions are all verified server-side:
- Customer payment for the relevant stage is confirmed `paid`
- Operator KYC is approved (`payout_enabled = true`)
- Operator has a verified Paystack Transfer recipient code
- No active dispute exists on the booking
- The 48-hour refund window has elapsed (Stage 1 only)
- No administrative payout hold is active on the operator account

A tiered platform commission is deducted from each payout before transfer (see Question 3).

Further detail on our payment architecture is available at:  
https://shareconload.com/payment-flow

---

## 2. Operator Vetting and KYC

All logistics operators on ShareConLoad must pass a document-based KYC review before any payouts are enabled on their account.

**Documents collected:**

- Proof of Identity — passport or national ID
- Business Registration Certificate
- Proof of Warehouse Address — lease agreement or utility bill
- Tax Clearance Certificate
- Banking Confirmation Letter
- Cargo Insurance Certificate
- Freight Forwarding License (where applicable)

**Vetting process:**

1. Operator submits all required documents through the platform during onboarding.
2. Each document is reviewed individually by our admin team.
3. Documents are approved or rejected with recorded status per item.
4. The operator's account is only marked `payout_enabled = true` once all required documents are approved.
5. Operators who have not completed KYC cannot receive payouts, regardless of booking or payment status.
6. Admins retain the ability to place a `payout_hold` on any operator account at any time pending further review.

Further detail on our operator verification process is available at:  
https://shareconload.com/operator-verification

---

## 3. Pricing Structure

ShareConLoad operates on a commission-based model. There are no listing fees, monthly fees, or subscription charges.

**Commission is tiered on the gross payout amount per payment stage:**

| Gross Payout (ZAR) | Platform Commission |
|---|---|
| R0 – R5,000 | 12% |
| R5,001 – R20,000 | 10% |
| R20,001 – R50,000 | 8% |
| R50,001 and above | 6% |

Commission is deducted before each payout is transferred to the operator via the Paystack Transfer API. Customers pay the full booking price as listed; the commission is borne by the operator from their payout.

Further detail on our pricing model is available at:  
https://shareconload.com/pricing

---

## 4. Dispute Handling

ShareConLoad provides a structured dispute process for customers who experience issues with a shipment.

**How a dispute is raised:**

1. The customer selects the relevant booking and submits a dispute with a category:
   - Cargo damage
   - Short delivery
   - Overcharge
   - Delay
   - Other
2. The customer provides a written description and may upload supporting evidence (photos, documents).
3. On dispute submission, the operator's payout for that booking is automatically blocked until the dispute is resolved.

**Admin review:**

- Our admin team reviews all disputes within 2 business days.
- Possible outcomes include: full refund, partial refund, payout release to operator, platform credits to customer, or operator penalty.
- All dispute decisions and evidence are logged in the platform's audit trail.

Further detail on our dispute resolution process is available at:  
https://shareconload.com/dispute-resolution

---

## 5. Refund and Cancellation Policy

**Cancellation windows and refund eligibility:**

| Timing | Refund Outcome |
|---|---|
| Within 48 hours of booking | 20% deposit may be refunded; service fees are non-refundable |
| After 48 hours, before 50% payment | Deposit is non-refundable |
| After 50% payment, before departure | Partial refund subject to admin review |
| After container has departed | Fully non-refundable |

**Process:**

- Refunds are never automatic. All refunds require explicit admin approval.
- Once approved, refunds are processed via the Paystack refund API through our `process-refund` Edge Function.
- Refund status is tracked in the platform and the customer is notified on completion.

Our full cancellation and refund policy is published at:  
https://shareconload.com/cancellation

---

## Transparency Pages

For your review, the following pages on our platform provide public-facing documentation of the above policies:

- Payment flow: https://shareconload.com/payment-flow
- Operator verification: https://shareconload.com/operator-verification
- Dispute resolution: https://shareconload.com/dispute-resolution
- Pricing: https://shareconload.com/pricing
- Cancellation and refund policy: https://shareconload.com/cancellation

---

We trust this addresses all of your review questions. Please do not hesitate to reach out if you require any additional information or documentation.

Kind regards,

**Justice Baloyi**  
VEYQON GROUP (Pty) Ltd  
Registration: 2026/353683/07  
support@shareconload.com
