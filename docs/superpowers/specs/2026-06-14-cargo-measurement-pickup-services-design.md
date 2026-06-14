# ShareConLoad Services Upgrade — Design Spec

**Date:** 2026-06-14
**Scope:** Two new platform roles + three new services

---

## What We're Building

Three new services and two new roles on top of the existing platform:

| Service | New Role | Commission |
|---|---|---|
| Cargo Measurement | Measurement Agent | 20% platform / 80% agent |
| Pickup & Drop-off | Transporter | 15% platform / 85% transporter |
| Self-Declaration CBM | (no new role) | existing booking commission |

Build order: **Phase 1 → Phase 2 → Phase 3**. Each phase is independently deployable.

---

## Phase 1: Roles & Onboarding

### New Role Types

Add two values to the `profiles.role_type` enum:
- `measurement_agent`
- `transporter`

These join the existing: `customer`, `operator`, `agent`, `admin`.

---

### Measurement Agent Profile

**Table: `measurement_agent_profiles`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK profiles.id | unique |
| full_name | text NOT NULL | |
| phone_number | text | |
| base_city | text NOT NULL | matching key for job assignment |
| base_country | text NOT NULL | |
| id_document_url | text | ID photo upload |
| selfie_url | text | selfie holding ID |
| equipment_photo_url | text | photo of measuring tape + tools |
| certification_test_passed | boolean DEFAULT false | must pass before approval |
| service_agreement_signed_at | timestamptz | |
| status | text DEFAULT 'pending' | pending / approved / rejected / suspended |
| rejection_reason | text | |
| average_rating | numeric(3,2) | updated after each job |
| total_jobs_completed | int DEFAULT 0 | |
| paystack_recipient_code | text | set after bank registration |
| payout_enabled | boolean DEFAULT false | admin-toggled |
| payout_hold | boolean DEFAULT false | admin-toggled |
| created_at | timestamptz DEFAULT now() | |

**Onboarding flow — `/onboarding/measurement-agent`**

Multi-step form with 4 steps:
1. **Personal Info** — full name, phone, base city + country
2. **Documents** — upload ID photo, selfie with ID, equipment photo (measuring tape visible)
3. **Certification Test** — 5 multiple-choice questions about cargo measurement best practices. Must score 4/5 (80%) to proceed. Retakes allowed.
4. **Service Agreement** — display agreement, click to confirm. Sets `service_agreement_signed_at`.

On completion: `status = 'pending'`. Notification sent to user: "Application received."

---

### Transporter Profile

**Table: `transporter_profiles`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK profiles.id | unique |
| full_name | text NOT NULL | |
| phone_number | text | |
| base_city | text NOT NULL | matching key for job assignment |
| base_country | text NOT NULL | |
| vehicle_type | text NOT NULL | bakkie / small_truck / large_truck |
| vehicle_capacity_kg | numeric | |
| vehicle_capacity_cbm | numeric | |
| vehicle_registration_number | text | |
| drivers_licence_url | text | |
| vehicle_ownership_url | text | registration papers |
| vehicle_photo_1_url | text | front |
| vehicle_photo_2_url | text | back |
| vehicle_photo_3_url | text | driver side |
| vehicle_photo_4_url | text | load area |
| service_agreement_signed_at | timestamptz | |
| status | text DEFAULT 'pending' | pending / approved / rejected / suspended |
| rejection_reason | text | |
| average_rating | numeric(3,2) | |
| total_jobs_completed | int DEFAULT 0 | |
| paystack_recipient_code | text | |
| payout_enabled | boolean DEFAULT false | |
| payout_hold | boolean DEFAULT false | |
| created_at | timestamptz DEFAULT now() | |

**Onboarding flow — `/onboarding/transporter`**

Multi-step form with 4 steps:
1. **Personal Info** — full name, phone, base city + country
2. **Vehicle Details** — vehicle type, capacity (kg + CBM), registration number
3. **Documents** — upload driver's licence, vehicle ownership proof
4. **Vehicle Photos** — 4 required photos (front, back, driver side, load area)
5. **Service Agreement** — display agreement, click to confirm.

On completion: `status = 'pending'`. Notification sent to user.

---

### Role Selection Update

`/onboarding/page.tsx` currently shows Operator vs Customer. Add two new cards:
- **Cargo Measurement Agent** — "Travel to shippers, measure cargo, earn per job"
- **Transporter** — "Collect cargo from shippers, deliver to warehouses, earn per delivery"

---

### Home Page Routing

After login, `role_type` determines destination:
- `customer` → `/` (marketplace)
- `operator` → `/operator`
- `agent` → `/agent`
- `measurement_agent` → `/measurement-agent`
- `transporter` → `/transporter`
- `admin` → `/admin`

---

### Measurement Agent Portal

**`/measurement-agent`** — Dashboard: pending jobs count, completed jobs, total earnings, rating.

**`/measurement-agent/jobs`** — List of jobs (assigned / in_progress / completed).

**`/measurement-agent/jobs/[id]`** — Job detail page (Phase 2 — needs measurement service tables).

---

### Transporter Portal

**`/transporter`** — Dashboard: active jobs, completed jobs, total earnings, rating.

**`/transporter/jobs`** — Job list.

**`/transporter/jobs/[id]`** — Job detail (Phase 3 — needs pickup tables).

---

### Admin Pages (Phase 1)

**`/admin/measurement-agents`** — List all measurement agent applications. Filter by status. Approve / Reject (with reason). Show: name, base city, certification status, status, created date.

**`/admin/transporters`** — List all transporter applications. Filter by status. Approve / Reject. Show: name, base city, vehicle type, capacity, status.

Approve/Reject use Server Actions in `actions/adminMeasurementAgentActions.ts` and `actions/adminTransporterActions.ts`.

---

### Storage Buckets

- `measurement-agent-docs` — ID, selfie, equipment photos
- `transporter-docs` — licence, ownership, vehicle photos

Both: owner-only upload, admin read.

---

## Phase 2: Cargo Measurement Service

### New Tables

**`measurement_rate_bands`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| zone_name | text NOT NULL | label e.g. "Johannesburg Metro" |
| base_fee | numeric NOT NULL | flat fee in ZAR |
| created_at | timestamptz DEFAULT now() | |
| active | boolean DEFAULT true | admin can deactivate |

Simple flat fee per zone for MVP. Admin sets this via `/admin/rate-bands`.

**`measurement_jobs`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| shipper_profile_id | uuid FK profiles.id | |
| measurement_agent_profile_id | uuid FK measurement_agent_profiles.id | nullable until assigned |
| pickup_address | text NOT NULL | shipper's street address |
| pickup_city | text NOT NULL | used for agent matching |
| pickup_country | text NOT NULL | |
| quoted_fee | numeric NOT NULL | from rate band at time of request |
| status | text DEFAULT 'pending_payment' | pending_payment / paid / assigned / in_progress / completed / cancelled |
| payment_ref | text | Paystack reference |
| rate_band_id | uuid FK measurement_rate_bands.id | |
| assigned_at | timestamptz | |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | |

**`measurement_job_items`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK measurement_jobs.id | |
| description | text NOT NULL | |
| quantity | int DEFAULT 1 | |
| length_m | numeric | |
| width_m | numeric | |
| height_m | numeric | |
| weight_kg | numeric | |
| cbm_per_unit | numeric | calculated: L×W×H |
| total_cbm | numeric | cbm_per_unit × quantity |
| created_at | timestamptz DEFAULT now() | |

**`measurement_reports`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK measurement_jobs.id UNIQUE | one report per job |
| total_cbm | numeric NOT NULL | sum of all items |
| total_weight_kg | numeric | |
| item_count | int | |
| platform_report_ref | text UNIQUE | auto-generated e.g. "MCR-20260614-001" |
| agent_notes | text | optional |
| generated_at | timestamptz DEFAULT now() | |

**`measurement_report_photos`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| report_id | uuid FK measurement_reports.id | |
| photo_type | text NOT NULL | cargo_1 / cargo_2 / cargo_3 / cargo_4 / tape_measure / scale / location |
| file_url | text NOT NULL | |
| uploaded_at | timestamptz DEFAULT now() | |

7 photos required: cargo_1 through cargo_4, tape_measure, scale, location.

**`measurement_job_payments`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK measurement_jobs.id UNIQUE | |
| paystack_ref | text | |
| amount | numeric NOT NULL | |
| status | text DEFAULT 'pending' | pending / paid / refunded / failed |
| paid_at | timestamptz | |

---

### Bookings Table Additions

| Column | Type | Notes |
|---|---|---|
| cbm_declaration_type | text DEFAULT 'self_declared' | self_declared / measurement_verified |
| measurement_report_id | uuid FK measurement_reports.id | nullable |
| cbm_disclaimer_acknowledged_count | int DEFAULT 0 | must reach 2 before booking submits (self_declared only) |
| actual_cbm_at_loading | numeric | filled by operator when cargo is loaded |
| cbm_variance_pct | numeric | calculated: (actual - declared) / declared × 100 |
| cbm_variance_adjustment | numeric | positive = surcharge added to Stage 2, negative = credit |

---

### Shipper Flow — Measurement Service

**`/measurement-service`**

1. Shipper enters pickup address and city.
2. System looks up rate band by city match → shows quoted fee.
3. Shipper pays via Paystack (Edge Function: `initialize-measurement-payment`).
4. `measurement_jobs` record created with `status = 'paid'`.
5. Admin is notified to assign an agent.
6. Shipper receives: "Job confirmed. An agent will contact you within 24 hours."

**`/measurement-service/[jobId]`** — Track job status and view completed report.

---

### Agent Flow — Job Execution

On `/measurement-agent/jobs/[id]`:

1. Agent clicks "Start Job" → status = `in_progress`.
2. Agent adds measured items: description, L×W×H, weight, quantity. CBM calculated live.
3. Agent uploads 7 required photos.
4. Agent clicks "Submit Report" → `measurement_reports` record created, job status = `completed`.
5. System triggers 80% payout to agent (Edge Function: `trigger-measurement-agent-payout`).
6. Shipper notified: "Your measurement report is ready."

---

### Admin — Measurement Assignment

**`/admin/measurement-jobs`** — List all jobs. For `paid` status jobs: assign an agent (dropdown of approved agents in same city).

**`/admin/rate-bands`** — Create / edit / deactivate rate bands (zone name + base fee).

---

### Self-Declaration CBM — Booking Form Changes

At the top of the booking form, shipper chooses:
- **"I know my dimensions (self-declare)"** — continues existing flow with disclaimer
- **"I need a measurement agent"** — button links to `/measurement-service` (new tab)

If self-declare chosen:
1. First acknowledgement: checkbox "I understand that my CBM declaration affects my booking price and may be verified at loading."
2. After clicking submit, second acknowledgement modal: "I confirm my declared CBM is accurate. A ±5% variance is allowed. Overages will be billed; underages will be credited against Stage 2 payment." Must click "I Confirm" to proceed.
3. `cbm_disclaimer_acknowledged_count` saved as 2.

If `measurement_verified`: booking uses CBM from the attached report. No disclaimer needed.

---

### CBM Variance — Stage 2 Adjustment

When operator records `actual_cbm_at_loading`:
- Calculate `cbm_variance_pct = (actual - declared) / declared × 100`
- If variance > +5%: `cbm_variance_adjustment = (actual - declared) × price_per_cbm` (positive, added to Stage 2)
- If variance < -5%: `cbm_variance_adjustment = (actual - declared) × price_per_cbm` (negative, credit against Stage 2)
- Within ±5%: no adjustment
- Stage 2 payment UI shows: "Stage 2 — R X,XXX + CBM adjustment R YYY = R Z,ZZZ"

---

### Edge Functions (Phase 2)

- `initialize-measurement-payment` — creates Paystack transaction for measurement job
- `verify-measurement-payment` — verifies completed payment, updates `measurement_job_payments.status = 'paid'` and `measurement_jobs.status = 'paid'`
- `trigger-measurement-agent-payout` — transfers 80% of job fee to agent's Paystack recipient code

---

## Phase 3: Pickup & Drop-off Service

### New Tables

**`transporter_rate_bands`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| zone_name | text NOT NULL | |
| origin_city | text NOT NULL | |
| origin_country | text NOT NULL | |
| base_fee | numeric NOT NULL | |
| per_cbm_fee | numeric DEFAULT 0 | optional per-CBM surcharge |
| vehicle_type | text | null = applies to all types |
| active | boolean DEFAULT true | |
| created_at | timestamptz DEFAULT now() | |

**`pickup_jobs`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK bookings.id | |
| shipper_profile_id | uuid FK profiles.id | |
| transporter_profile_id | uuid FK transporter_profiles.id | nullable until selected |
| pickup_address | text NOT NULL | shipper's address |
| pickup_city | text NOT NULL | |
| pickup_country | text NOT NULL | |
| warehouse_address | text NOT NULL | operator's warehouse (from container) |
| total_cbm | numeric | from booking |
| total_weight_kg | numeric | from booking shipment items |
| quoted_fee | numeric NOT NULL | |
| status | text DEFAULT 'pending_selection' | pending_selection / pending_payment / paid / assigned / collected / delivered / cancelled |
| shortlisted_transporter_ids | uuid[] | top 3 matches |
| payment_ref | text | |
| selected_at | timestamptz | |
| collected_at | timestamptz | |
| delivered_at | timestamptz | |
| payout_released_at | timestamptz | |
| created_at | timestamptz DEFAULT now() | |

**`pickup_job_payments`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| job_id | uuid FK pickup_jobs.id UNIQUE | |
| paystack_ref | text | |
| amount | numeric NOT NULL | |
| status | text DEFAULT 'pending' | pending / paid / refunded / failed |
| paid_at | timestamptz | |

---

### Shipper Flow — Pickup Request

**`/pickup/[bookingId]`** — shown after Stage 1 payment is confirmed.

1. Page loads booking details (CBM, weight, operator warehouse address already known from container).
2. Shipper enters pickup address and city.
3. System looks up transporter rate band by city → calculates fee (base + per_cbm × total_cbm).
4. System matches transporters: `approved` + `base_city = pickup_city` + `vehicle_capacity_cbm >= total_cbm`, ordered by `average_rating DESC`, top 3 shown.
5. Shipper selects one (or skips to self drop-off).
6. Shipper pays via Paystack → `pickup_jobs.status = 'paid'`.
7. Transporter receives notification of assigned job.

If shipper skips: no `pickup_job` created. Booking continues with self drop-off.

---

### Transporter Flow

On `/transporter/jobs/[id]`:

1. View job details: pickup address, shipper contact, warehouse address, CBM/weight.
2. "Confirm Collection" button → `pickup_jobs.collected_at = now()`, status = `collected`. Shipper notified.
3. "Confirm Delivery" button → `pickup_jobs.delivered_at = now()`, status = `delivered`. 85% payout triggered. Operator notified.

---

### Admin — Pickup Jobs

**`/admin/pickup-jobs`** — List all pickup jobs. View status, shipper, transporter, booking reference. Can cancel a job if needed.

**`/admin/rate-bands`** — Expanded to include transporter rate bands (add tab alongside measurement rate bands).

---

### Edge Functions (Phase 3)

- `initialize-pickup-payment`
- `verify-pickup-payment`
- `trigger-transporter-payout` — transfers 85% to transporter Paystack recipient on delivery confirmation

---

## RLS Policy Pattern

All new profile tables follow the existing `profiles` + `operator_profiles` pattern:

- Owner can SELECT/UPDATE their own row (match via `profiles.user_id = auth.uid()`)
- Admin (`is_admin()`) can SELECT/UPDATE all rows
- INSERT only during onboarding (authenticated user)

Job tables:
- Shipper can SELECT their own jobs
- Assigned agent/transporter can SELECT their assigned jobs
- Admin can SELECT/UPDATE all

---

## Constraints & Simplifications for MVP

- No live GPS tracking. Agents/transporters register a fixed base city. Matching is city-string-based (exact match for MVP, not geo-radius).
- No GPS metadata validation on photos. Photo-only evidence for now.
- Admin manually assigns measurement agents from a dropdown (no auto-assignment algorithm in Phase 2 MVP).
- Transporter shortlist is shown to shipper from top 3 rated in their city. Shipper picks one.
- Certification test is 5 hardcoded questions in the onboarding UI. Pass = 4/5 correct.
- Payouts require admin to toggle `payout_enabled = true` on each agent/transporter profile (same as operator pattern).
- No multi-currency for new services. All fees in ZAR.

---

## Navigation Changes

`/admin/page.tsx` (admin hub) — add links to:
- Measurement Agents (`/admin/measurement-agents`)
- Transporters (`/admin/transporters`)
- Measurement Jobs (`/admin/measurement-jobs`)
- Pickup Jobs (`/admin/pickup-jobs`)
- Rate Bands (`/admin/rate-bands`)

`/onboarding/page.tsx` — add role cards for Measurement Agent and Transporter.

Home page login redirect — extend role routing for new roles.

---

## File Structure

### New pages

```
app/
  onboarding/
    measurement-agent/page.tsx
    transporter/page.tsx
  measurement-agent/
    page.tsx                          → Dashboard
    jobs/page.tsx                     → Job list
    jobs/[id]/page.tsx                → Job detail + report submission (Phase 2)
  transporter/
    page.tsx                          → Dashboard
    jobs/page.tsx                     → Job list
    jobs/[id]/page.tsx                → Job detail + collection/delivery (Phase 3)
  measurement-service/
    page.tsx                          → Request measurement (Phase 2)
    [jobId]/page.tsx                  → Track job + view report (Phase 2)
  pickup/
    [bookingId]/page.tsx              → Request pickup after booking (Phase 3)
  admin/
    measurement-agents/page.tsx       → Phase 1
    transporters/page.tsx             → Phase 1
    measurement-jobs/page.tsx         → Phase 2
    pickup-jobs/page.tsx              → Phase 3
    rate-bands/page.tsx               → Phase 2 (extended in Phase 3)
```

### New actions

```
actions/
  adminMeasurementAgentActions.ts
  adminTransporterActions.ts
```

### New migrations

```
supabase/migrations/
  20260614_52_new_role_types.sql
  20260614_53_measurement_agent_profiles.sql
  20260614_54_transporter_profiles.sql
  20260614_55_measurement_service_tables.sql
  20260614_56_bookings_cbm_declaration_columns.sql
  20260614_57_pickup_service_tables.sql
```

### New Edge Functions

```
supabase/functions/
  initialize-measurement-payment/index.ts
  verify-measurement-payment/index.ts
  trigger-measurement-agent-payout/index.ts
  initialize-pickup-payment/index.ts
  verify-pickup-payment/index.ts
  trigger-transporter-payout/index.ts
```
