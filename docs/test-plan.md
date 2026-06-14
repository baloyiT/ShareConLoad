# ShareConLoad — Complete Test Plan

**Project:** fkhfbifgvebygafsewot (Supabase · eu-central-1)
**Stack:** Next.js 15 App Router · TypeScript · Supabase · Paystack · Vercel
**Last updated:** 2026-06-13

---

## 1. Test Environment Setup

### 1.1 Prerequisites

| Requirement | Command / Action |
|-------------|-----------------|
| Dev server running | `npm run dev` (port 3000) |
| Test users provisioned | `node tests/create-test-users.mjs` |
| `.env.local` configured | See section 1.3 |
| Playwright installed | `npx playwright install` |
| Run all automated tests | `npx playwright test` |

### 1.2 Test Accounts

| Role | Email | Password | State |
|------|-------|----------|-------|
| Admin | justice.baloyi@gmail.com | (production creds) | is_admin=true |
| Operator | mercy.affulbaloyi@gmail.com | TestOperator@2026! | compliance approved |
| Agent | justice_baloyi@yahoo.com | TestAgent@2026! | KYC approved |
| Customer (verified) | customer.shareconload@gmail.com | TestCustomer@2026! | KYC verified |

### 1.3 Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TEST_AGENT_EMAIL=justice_baloyi@yahoo.com
TEST_AGENT_PASSWORD=TestAgent@2026!
TEST_OPERATOR_EMAIL=mercy.affulbaloyi@gmail.com
TEST_OPERATOR_PASSWORD=TestOperator@2026!
TEST_CUSTOMER_EMAIL=customer.shareconload@gmail.com
TEST_CUSTOMER_PASSWORD=TestCustomer@2026!
TEST_ADMIN_EMAIL=justice.baloyi@gmail.com
TEST_ADMIN_PASSWORD=
```

### 1.4 Test Documents

| User | Location |
|------|----------|
| Agent KYC documents | `Test Case/Agent/documents/` |
| Operator compliance docs | `Test Case/Operator/documents/` |
| Customer KYC documents | `Test Case/Customer/documents/` |
| Shared PDF fixtures | `tests/fixtures/` |

### 1.5 Test Execution Order (full regression)

1. AUTH — establish sessions
2. ONBOARD — create all role profiles
3. ADMIN (KYC approvals) — approve agent + customer
4. CONTAINER — create test containers
5. BOOKING — create bookings
6. PAYMENT — verify staged payment flow
7. TRACK — advance bookings through milestones
8. RATING — submit post-delivery ratings
9. MSG / DISPUTE / SUPPORT — run independently
10. ADMIN (operations) — payout, cargo release, compliance
11. RLS — negative access-control tests last

---

## 2. Test Cases

---

### TC-AUTH — Authentication

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| AUTH-01 | Register new account | Anon | 1. `/auth/register` 2. Fill email, password, full_name 3. Submit | Account created; redirected to `/onboarding` |
| AUTH-02 | Login — valid credentials | Anon | 1. `/auth/login` 2. Enter correct email + password | Redirected to home (customer) or `/operator` (operator) |
| AUTH-03 | Login — wrong password | Anon | 1. Enter wrong password 2. Submit | Error shown; no redirect |
| AUTH-04 | Login — role-aware redirect (admin) | Admin | Login as admin | Redirected to `/`; admin nav visible |
| AUTH-05 | Session persistence | Any | 1. Login 2. Close tab 3. Reopen | Still logged in |
| AUTH-06 | Logout | Any | 1. Click logout | Session cleared; redirected to login |
| AUTH-07 | Protect authenticated routes | Anon | Navigate to `/operator` | Redirected to `/auth/login` |
| AUTH-08 | Auth callback (OAuth / magic link) | Any | Trigger Supabase link | `/auth/callback` processes token; session created |
| AUTH-09 | Forgot password — submit email | Anon | 1. `/auth/forgot-password` 2. Enter email 3. Submit | Confirmation shown |
| AUTH-10 | Reset password — mismatch | Anon | 1. `/auth/reset-password` 2. Enter mismatched passwords | Error: passwords do not match |

---

### TC-ONBOARD — Onboarding & Role Selection

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| ONBOARD-01 | View onboarding page | New user | Go to `/onboarding` | Cards for Customer, Operator, Agent shown |
| ONBOARD-02 | Existing role marked active | Customer | Login → `/onboarding` | Customer card shows "You have this role" |
| ONBOARD-03 | Add a second role | Customer | RoleSwitcher → "Add a role" | `/onboarding` shown; existing role marked |
| ONBOARD-04 | Operator onboarding — complete | New operator | `/onboarding/operator` → fill all fields → submit | `operator_profiles` row created; redirected to `/operator` |
| ONBOARD-05 | Operator onboarding — missing field | New operator | Submit without bank_name | Validation error; no insert |
| ONBOARD-06 | Customer KYC — step 1 | New customer | `/onboarding/customer` → full_name + id_type=passport + id_number → submit | Redirected to `/onboarding/customer/documents` |
| ONBOARD-07 | Customer KYC — step 2 doc upload | Customer | Upload id_document PDF → submit | File in `customer-kyc` bucket; row status=`pending_review`; redirected to status page |
| ONBOARD-08 | Customer KYC — status: pending | Customer | `/onboarding/customer/status` | Tracker step 1+2 highlighted; CTA "Back to Home" |
| ONBOARD-09 | Customer KYC — status: verified | Verified customer | `/onboarding/customer/status` | All steps complete; CTA "Browse Containers" |
| ONBOARD-10 | Customer KYC — status: rejected | Rejected customer | `/onboarding/customer/status` | Rejection reason shown; CTA "Resubmit" |
| ONBOARD-11 | Agent — step 1 business details | New agent | `/onboarding/agent` → business_name + country + corridors → submit | Redirected to `/onboarding/agent/credentials` |
| ONBOARD-12 | Agent — step 2 credentials | Agent | Fill license_number (required) → submit | Redirected to `/onboarding/agent/documents` |
| ONBOARD-13 | Agent — step 3 documents | Agent | Upload freight-forwarder-license (required) → submit | Files in `agent-documents`; redirected to `/onboarding/agent/bank` |
| ONBOARD-14 | Agent — step 4 bank | Agent | Fill bank_name + account_number → submit | Redirected to `/onboarding/agent/review` |
| ONBOARD-15 | Agent — step 5 review + submit | Agent | Check agreement → submit | `agent_profiles.status`=`pending_review`; redirected to `/onboarding/agent/status` |
| ONBOARD-16 | Agent — status: pending | Agent | `/onboarding/agent/status` | "Under Review" message |
| ONBOARD-17 | Agent — submit without required doc | Agent (step 3) | Skip license upload → submit | Error: required document missing |
| ONBOARD-18 | Agent — submit without agreement | Agent (step 5) | Leave checkbox unchecked | Submit blocked |

---

### TC-CONTAINER — Container Discovery

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| CONT-01 | Browse containers | Anon | Go to `/` | Container cards listed; shows origin, destination, local price + USD |
| CONT-02 | Filter by max price (USD) | Anon | Set price filter | Only containers with `price_per_cbm_usd` ≤ filter shown |
| CONT-03 | Filter by origin / destination | Anon | Enter origin city | Filtered list |
| CONT-04 | Container detail page | Anon | Click card → `/container/[id]` | Shows capacity, price, operator info, available CBM |
| CONT-05 | Container in non-ZAR currency | Any | View GHS container | Card shows GHS price + USD equivalent |
| CONT-06 | No results — empty state | Anon | Filter returns nothing | "No containers found" message |
| CONT-07 | Full container — booking blocked | Anon | View container with 0 available CBM | Book button disabled or hidden |
| CONT-08 | Invalid container ID | Anon | `/container/invalid-uuid` | Not-found state shown |

---

### TC-BOOKING — Booking Flow

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| BOOK-01 | KYC gate — no KYC | Unverified customer | `/booking/[id]` | Gate: "Verify My Identity" CTA; form not rendered |
| BOOK-02 | KYC gate — pending | Customer (pending) | `/booking/[id]` | Gate: "Check Verification Status" CTA |
| BOOK-03 | KYC gate — rejected | Customer (rejected) | `/booking/[id]` | Gate: "Resubmit" CTA |
| BOOK-04 | Booking form visible (verified) | Verified customer | `/booking/[id]` | Full form rendered |
| BOOK-05 | Create booking — happy path | Verified customer | Fill CBM + item + confirm declaration → submit | Booking row created; 3 payment records auto-generated; redirected to `/payments/[bookingId]` |
| BOOK-06 | Exceed available capacity | Verified customer | Enter CBM > available | Error: "Exceeds available capacity" |
| BOOK-07 | Multiple shipment items | Verified customer | Add 2+ items | All items saved to `shipment_items` |
| BOOK-08 | Declaration not confirmed | Verified customer | Leave declaration unchecked → submit | Blocked: declaration required |
| BOOK-09 | Price auto-calculated | Verified customer | Enter CBM | Total = CBM × price_per_cbm shown live |
| BOOK-10 | Booking creates status history | System | Submit booking | `booking_status_history` row: status=`pending` |
| BOOK-11 | Anon cannot book | Anon | Navigate to `/booking/[id]` | Redirected to login |
| BOOK-12 | Item photo upload | Verified customer | Upload photo on shipment item | Stored in `item-photos` bucket; `photo_urls` array populated |

---

### TC-PAYMENT — Staged Payments

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| PAY-01 | View payment stages | Customer | `/payments/[bookingId]` | 3 stages: deposit_20 (actionable), pre_departure_50 (locked), final_release_30 (locked) |
| PAY-02 | Pay deposit (stage 1) | Customer | Click "Pay Deposit" | Edge function `initialize-payment` called; Paystack redirect opened |
| PAY-03 | Stage 2 locked before stage 1 paid | Customer | Attempt to pay stage 2 | Button disabled; locked state shown |
| PAY-04 | Payment verified (webhook) | System | Paystack test webhook fires `charge.success` | `payments.status`=`paid`; booking advances if applicable |
| PAY-05 | Payment history | Customer | `/payments/history` | All own payment records listed |
| PAY-06 | Booking blocked if deposit unpaid | System | Booking in `pending`; deposit not `paid` | Cannot advance to `confirmed` |
| PAY-07 | 3 records auto-created | System | Submit booking → `select count(*) from payments where booking_id=?` | Returns 3 |
| PAY-08 | Stage amounts correct | System | Check payment records | deposit=20%, pre_departure=50%, final=30% of total_price |
| PAY-09 | Operator cannot view customer payments | Operator | Query payments for own booking | RLS blocks; 0 rows |
| PAY-10 | Admin views all payments | Admin | `/admin/bookings` → booking detail | All 3 payment records visible |

---

### TC-PAYOUT — Operator Payouts

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| POUT-01 | Payout eligibility | Admin | `/admin/operators` | Payout button enabled only when all conditions met |
| POUT-02 | Trigger payout | Admin | Click "Trigger Payout" | Edge function `trigger-payout` called; `payouts` row created |
| POUT-03 | Blocked — no recipient code | Admin | Operator missing `paystack_recipient_code` | Payout disabled; warning shown |
| POUT-04 | Blocked — payout_hold=true | Admin | Operator on hold | Payout disabled |
| POUT-05 | Payout amount = 95% | System | Check payout record | amount = payment_amount × 0.95 |
| POUT-06 | Blocked — active dispute | System | Booking has open dispute | Payout not triggerable |
| POUT-07 | Register transfer recipient | Admin | Submit bank details → "Register with Paystack" | `create-transfer-recipient` called; `paystack_recipient_code` saved |
| POUT-08 | Admin views payout list | Admin | `/admin/payouts` | All payouts across all operators listed |

---

### TC-TRACK — Shipment Tracking & Milestones

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| TRACK-01 | View milestone timeline | Customer | `/booking/track/[id]` | Timeline shows all milestones in order |
| TRACK-02 | Record milestone | Operator | `/operator/bookings` → add milestone | `shipment_milestones` row created |
| TRACK-03 | Cannot record for other operator | Operator | Update different operator's booking | RLS blocks |
| TRACK-04 | Advance booking status | Operator | pending → confirmed → loaded → in_transit → delivered | Each step recorded in `booking_status_history` |
| TRACK-05 | Status lifecycle enforced | Operator | Jump from pending → delivered | Blocked or validation error |
| TRACK-06 | Cancel from any stage | Operator/Admin | Set status=`cancelled` | Status updated; history recorded |
| TRACK-07 | `delivered_at` auto-set | System | Set status=`delivered` | `bookings.delivered_at` populated by trigger |
| TRACK-08 | Invalid booking ID | Customer | `/booking/track/invalid` | Error state shown |

---

### TC-RATING — Ratings & Reviews

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| RATE-01 | Customer rates after delivery | Customer | Submit 1–5 stars + comment | `booking_ratings` row created; `revealed_at` null |
| RATE-02 | Both parties rated — mutual reveal | Operator | Operator also rates same booking | Both rows `revealed_at` = now() |
| RATE-03 | Rating blocked before delivery | Customer | Booking in `in_transit`; try to rate | RLS blocks insert |
| RATE-04 | Cannot rate twice | Customer | Submit second rating | Unique constraint error on (booking_id, rater_id) |
| RATE-05 | Auto-reveal after 14 days | Any | `booking.delivered_at` > 14 days ago | Rating visible even with only one party rated |
| RATE-06 | Operator rating summary | Any | Query `operator_rating_summary` | Returns avg_stars and review_count |

---

### TC-MSG — Booking Messages

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| MSG-01 | Customer sends message | Customer | Open thread → type → send | Message stored; visible to operator |
| MSG-02 | Operator replies | Operator | View thread → reply | Message stored; visible to customer |
| MSG-03 | Email blocked | Customer | Send "test@example.com" | Exception: contact details not allowed |
| MSG-04 | URL blocked | Customer | Send "https://wa.me/123" | Blocked |
| MSG-05 | SA phone number blocked | Customer | Send "+27 82 123 4567" | Blocked |
| MSG-06 | Social handle blocked | Customer | Send "@johndoe" | Blocked |
| MSG-07 | Valid message passes | Customer | Send "When does the container depart?" | Saved successfully |
| MSG-08 | Third party cannot read | Other user | Query messages for booking they're not party to | RLS: 0 rows |

---

### TC-DISPUTE — Disputes & Claims

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| DISP-01 | Submit dispute | Customer | `/disputes/new` → select booking + reason → submit | `disputes` row: status=`open` |
| DISP-02 | Upload evidence | Customer | `/disputes/[id]` → upload PDF | File in `dispute-evidence` bucket; `dispute_evidence` row created |
| DISP-03 | Admin reviews dispute | Admin | `/admin/disputes` → view detail | Evidence + dispute info shown |
| DISP-04 | Admin resolves dispute | Admin | Set status=`resolved` | Status updated |
| DISP-05 | Active dispute blocks payout | System | Open dispute on booking | Operator payout blocked |
| DISP-06 | Insurance claim added | Admin | Add claim to dispute | `insurance_claims` row linked |
| DISP-07 | Operator cannot close dispute | Operator | Attempt status update | RLS blocks |

---

### TC-SUPPORT — Support Tickets

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| SUP-01 | Submit ticket | Customer | `/support/new` → fill subject + message → submit | `support_tickets` row created |
| SUP-02 | Admin views tickets | Admin | Query / admin page | All tickets listed |
| SUP-03 | Customer sees only own tickets | Customer | Query support_tickets | RLS: only own rows |

---

### TC-OPERATOR — Operator Dashboard

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| OPR-01 | Dashboard | Operator | `/operator` | Own containers listed with status and CBM |
| OPR-02 | Create container — happy path | Operator | Fill origin, destination, capacity, price, currency, departure → submit | Row created; `price_per_cbm_usd` computed; redirected to `/operator` |
| OPR-03 | Create container — missing field | Operator | Submit without origin | Validation error |
| OPR-04 | Currency selector | Operator | Select GHS → enter price → submit | `currency_code=GHS`; `price_per_cbm_usd` = price × fx_rate |
| OPR-05 | Manage bookings | Operator | `/operator/bookings` | All bookings for own containers shown |
| OPR-06 | Advance booking status | Operator | Change status → `confirmed` | Status updated; history recorded |
| OPR-07 | Compliance gate | Non-compliant operator | Try to create container | Blocked: compliance not approved |
| OPR-08 | Cannot see other operator's containers | Operator | View containers list | Only own containers |
| OPR-09 | Record departure notice | Operator | Trigger 7-day departure | `pre_departure_50` payment unlocked |
| OPR-10 | Operator compliance — full flow | New operator | Complete 4-step compliance form + doc upload | `operator_profiles` compliance status updated |
| OPR-11 | Operator payout history | Operator | `/operator/payouts` | Own payout records listed |

---

### TC-AGENT — Agent Portal

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| AGT-01 | Unapproved agent blocked | Agent (pending) | Go to `/agent` | Guard: "Application under review" |
| AGT-02 | Approved agent accesses portal | Agent (approved) | Go to `/agent` | Dashboard accessible |
| AGT-03 | Add managed shipper | Agent | Add shipper (name, email, country) | `agent_managed_shippers` row created |
| AGT-04 | View managed shippers | Agent | View shipper list | Only own shippers |
| AGT-05 | Cannot see other agent's shippers | Agent | Query agent_managed_shippers | RLS: only own rows |
| AGT-06 | Agent-facilitated booking | Agent | Create booking with managed_shipper_id | `bookings.agent_profile_id` + `managed_shipper_id` set |

---

### TC-ADMIN — Admin Operations

#### Admin Hub

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-01 | Admin hub | Go to `/admin` | Navigation links: Bookings, Operators, Payouts, Disputes, Compliance, Release, Agents, Customers, FX Rates, Contacts |
| ADM-02 | Non-admin blocked | Go to `/admin` as customer | Redirected or "Access Denied" |

#### User Management

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-03 | View all users | Admin users page | All profiles with email via `admin_get_users()` |
| ADM-04 | Grant admin | Toggle is_admin | User gains admin on next login |

#### Operator Compliance

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-05 | View compliance docs | `/admin/compliance` | All operator docs via `admin_get_compliance_docs()` |
| ADM-06 | Approve compliance doc | Set status=`approved` | Operator can create containers |
| ADM-07 | Reject compliance doc | Set status=`rejected` + note | Operator must resubmit |
| ADM-08 | View compliance flags | `/admin/compliance` | Flags with raiser name/email via `admin_get_compliance_flags()` |
| ADM-09 | Resolve flag | Set resolved=true | `resolved_at` set |

#### Agent KYC Review

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-10 | View agent applications | `/admin/agents` | All agent_profiles listed by status |
| ADM-11 | Approve agent | Click Approve | `agent_profiles.status`=`approved`; agent can access portal |
| ADM-12 | Reject agent | Enter reason → Reject | `status`=`rejected`; `rejection_reason` saved |
| ADM-13 | View agent documents | Click doc link in modal | File retrieved from `agent-documents` bucket |

#### Customer KYC Review

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-14 | View customer KYC | `/admin/customers` | All customer_kyc rows ordered by submitted_at |
| ADM-15 | Approve customer | Click Approve | `status`=`verified`; customer can book |
| ADM-16 | Reject customer | Enter reason → Reject | `status`=`rejected`; reason saved |

#### FX Rates

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-17 | View FX rates | `/admin/fx-rates` | All 9 currencies with rate_to_usd |
| ADM-18 | Update rate | Change ZAR rate → save | `fx_rates` row updated |
| ADM-19 | Non-admin cannot write | Customer attempts upsert | RLS blocks |

#### Cargo Release

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-20 | View release queue | `/admin/release` | All cargo_release_authorizations listed |
| ADM-21 | Toggle single condition | Set final_payment_confirmed=true | Condition saved |
| ADM-22 | All 4 conditions = release authorized | Check all 4 | Release enabled |
| ADM-23 | Partial conditions — no release | 3 of 4 checked | Release not authorized |

#### Bookings & Payouts

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-24 | View all bookings | `/admin/bookings` | All bookings across all operators |
| ADM-25 | Cancel booking | Set status=`cancelled` | Cancelled; history recorded |
| ADM-26 | Approve/trigger payout | `/admin/payouts` → approve | `trigger-payout` edge function called |
| ADM-27 | Process refund | Initiate refund | `process-refund` called; payment status=`refunded` |

#### Contact Submissions

| ID | Title | Steps | Expected |
|----|-------|-------|----------|
| ADM-28 | View contact submissions | Admin contact page | All `contact_submissions` rows |
| ADM-29 | Non-admin cannot read | Customer queries table | RLS: 0 rows |

---

### TC-CUSTOMS — Customs Events

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| CUST-01 | Record customs event | Admin | Add event to booking | `customs_events` row created |
| CUST-02 | Customs cleared → release condition | Admin | Set customs_cleared=true | One of 4 cargo release conditions met |
| CUST-03 | Customer sees customs events | Customer | View tracking page | Events shown on timeline |

---

### TC-AUDIT — Audit Logs

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| AUDIT-01 | KYC approval logged | System | Admin approves agent | `audit_logs`: action=`agent_kyc_approved` |
| AUDIT-02 | Payout logged | System | Payout triggered | `audit_logs`: action=`payout_triggered` |
| AUDIT-03 | Non-admin cannot read | Customer | Query audit_logs | RLS: 0 rows |

---

### TC-NOTIFY — Notifications

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| NOTIF-01 | KYC submission → admin notified | System | Customer submits KYC | Notification created for admin |
| NOTIF-02 | KYC approved → customer notified | System | Admin approves | Notification for customer |
| NOTIF-03 | KYC rejected → user notified | System | Admin rejects | Notification with rejection reason |
| NOTIF-04 | Booking confirmed → customer notified | System | Operator confirms | Notification for customer |
| NOTIF-05 | Users see only own notifications | Customer | Query notifications | RLS: only own rows |

---

### TC-WAITLIST — Waitlist

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| WAIT-01 | Submit to waitlist | Anon | Fill and submit form | `waitlist_entries` row created |
| WAIT-02 | Duplicate email rejected | Anon | Submit same email twice | Unique constraint error |
| WAIT-03 | Admin reads waitlist | Admin | Query waitlist_entries | All entries returned |
| WAIT-04 | Non-admin cannot read | Customer | Query waitlist_entries | RLS: 0 rows |

---

### TC-CONTACT — Contact Form

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| CF-01 | Submit contact form | Anon | Fill all fields → submit | `contact_submissions` row: status=`new` |
| CF-02 | Missing required field | Anon | Submit without subject | Validation error |
| CF-03 | Admin reads submissions | Admin | Query / admin page | All submissions returned |

---

### TC-CURRENCY — Multi-Currency

| ID | Title | Role | Steps | Expected |
|----|-------|------|-------|----------|
| FX-01 | Container listed in GHS | GH operator | Create container with currency=GHS | Card shows GHS price + USD equivalent |
| FX-02 | USD filter cross-currency | Anon | Set max $50/CBM | ZAR and GHS containers filtered by `price_per_cbm_usd` |
| FX-03 | USD price computed at listing | System | Create ZAR container: price=100 | `price_per_cbm_usd` = 100 × 0.054 = 5.40 |
| FX-04 | Admin updates rate | Admin | Change ZAR to 0.055 | New containers use updated rate |
| FX-05 | All 9 currencies in selector | Operator | Open currency selector on `/operator/create` | USD, ZAR, GHS, NGN, KES, GBP, EUR, XOF, EGP |

---

### TC-STORAGE — File Storage

| ID | Title | Bucket | Steps | Expected |
|----|-------|--------|-------|----------|
| STG-01 | Agent upload | agent-documents (private) | Upload as agent | File at `{uid}/{filename}`; accessible to uploader + admin |
| STG-02 | Agent file blocked for others | agent-documents | Download as different user | Access denied |
| STG-03 | Customer KYC upload | customer-kyc (private) | Upload as customer | File at `{uid}/{filename}`; accessible to uploader + admin |
| STG-04 | Customer KYC blocked for others | customer-kyc | Download as different user | Access denied |
| STG-05 | Item photos (public) | item-photos | Upload as authenticated user | File publicly readable |
| STG-06 | Dispute evidence upload | dispute-evidence | Upload as customer | File stored; linked to dispute row |
| STG-07 | Compliance doc upload | compliance-documents | Upload as operator | Linked to compliance_documents row |
| STG-08 | Admin reads private buckets | agent-documents, customer-kyc | Admin downloads file | Access granted |

---

### TC-RLS — Row-Level Security

| ID | Attempt | Expected |
|----|---------|----------|
| RLS-01 | Customer reads another customer's bookings | 0 rows |
| RLS-02 | Operator reads another operator's containers | 0 rows |
| RLS-03 | Agent reads another agent's profiles | 0 rows |
| RLS-04 | Multi-role user (customer+agent) inserts agent_profiles | Succeeds (IN subquery handles multiple profile rows) |
| RLS-05 | Anon inserts booking | Rejected |
| RLS-06 | Anon reads fx_rates | All rows returned (public read) |
| RLS-07 | Anon inserts waitlist entry | Succeeds |
| RLS-08 | `is_admin()` returns false for non-admin | Returns false |
| RLS-09 | Customer cannot update another customer's KYC | 0 rows affected |
| RLS-10 | Agent cannot update another agent's managed shippers | 0 rows affected |

---

### TC-STATIC — Static Pages

| ID | Page | Check |
|----|------|-------|
| STAT-01 | `/` | Hero rendered; container list loads; agent CTA visible |
| STAT-02 | `/how-it-works` | Customer, Operator, and Agent journey sections all present |
| STAT-03 | `/privacy` | Privacy Policy heading and content |
| STAT-04 | `/terms` | Terms and Conditions |
| STAT-05 | `/cancellation` | Cancellation and Refund Policy |
| STAT-06 | `/pricing` | Payment stage table + commission table |

---

## 3. Automated Test Coverage

### Existing — `tests/agent-onboarding.spec.ts` (8/8 passing)

| Test | Maps to |
|------|---------|
| Auth setup (login) | AUTH-02 |
| Step 1 Business Details | ONBOARD-11 |
| Step 2 Credentials | ONBOARD-12 |
| Step 3 Documents | ONBOARD-13 |
| Step 4 Bank Details | ONBOARD-14 |
| Step 5 Review & Submit | ONBOARD-15 |
| Status Page | ONBOARD-16 |
| Guard — unapproved agent | AGT-01 |

### Planned Playwright Specs

| File | Covers |
|------|--------|
| `tests/auth.spec.ts` | TC-AUTH |
| `tests/customer-kyc.spec.ts` | ONBOARD-06–10, BOOK-01–03 |
| `tests/booking-flow.spec.ts` | TC-BOOKING |
| `tests/operator-dashboard.spec.ts` | TC-OPERATOR |
| `tests/agent-portal.spec.ts` | TC-AGENT |
| `tests/admin-review.spec.ts` | ADM-10–16 |
| `tests/messaging.spec.ts` | TC-MSG |
| `tests/multi-currency.spec.ts` | TC-CURRENCY |
| `tests/rls.spec.ts` | TC-RLS |
| `tests/static-pages.spec.ts` | TC-STATIC |

### Auth Setup Files

| File | Saves state for |
|------|----------------|
| `tests/auth.setup.ts` | Agent (existing) |
| `tests/operator.setup.ts` | Operator |
| `tests/customer.setup.ts` | Verified customer |
| `tests/admin.setup.ts` | Admin |

---

## 4. Manual-Only Tests

These require sandbox credentials or interactive flows:

| ID | Reason |
|----|--------|
| PAY-02, PAY-04 | Paystack redirect + webhook delivery |
| POUT-02, POUT-07 | Paystack transfer / recipient API |
| ADM-27 | Paystack refund API |
| AUTH-08 | Supabase magic link email |
| NOTIF-01–04 | Depends on UI notification component |

---

## 5. Test File Structure

```
tests/
  auth.setup.ts                  # saves agent auth state (existing)
  create-test-users.mjs          # provisions test accounts via admin API
  agent-onboarding.spec.ts       # 8 agent KYC onboarding tests (existing, passing)
  fixtures/                      # shared PDF fixtures for upload tests
    freight-forwarder-license.pdf
    business-registration.pdf
    identity-document.pdf
    proof-of-address.pdf
    sample-doc.pdf
    test-doc.pdf

Test Case/
  Admin/profile.json
  Agent/profile.json + documents/
  Operator/profile.json + documents/
  Customer/profile.json + documents/
```
