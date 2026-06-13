# ShareConLoad — Global Expansion, Agent Role & Role Management Design

**Date:** 2026-06-13  
**Status:** Approved  
**Scope:** Four change areas — global market expansion, Agent role on home/how-it-works, Agent onboarding KYC, and role management UX

---

## 1. Global Market Expansion + Multi-Currency

### What Changes

- Remove all South Africa → Ghana-only copy, route constraints, and seed data references across the platform.
- Operators choose a currency when creating a container listing. Supported currencies (Paystack): ZAR, USD, GHS, NGN, KES, GBP, EUR, XOF, EGP.
- The platform stores two price fields per container:
  - `price_per_cbm` — operator's chosen currency and amount
  - `price_per_cbm_usd` — USD equivalent, computed at listing time using the current FX rate
- Container cards display both: e.g. `ZAR 1,800 / CBM` with `≈ USD 98` in smaller grey text.
- The home page price search filter label changes from `Max Price / CBM (ZAR)` to `Max Price / CBM (USD equiv.)`. Filtering operates on `price_per_cbm_usd` so mixed-currency listings are comparable.

### FX Rate Architecture

**Table:** `fx_rates (currency_code text PK, rate_to_usd numeric, updated_at timestamptz)`

**Sprint 1 (manual):** Admin updates rates via `/admin/fx-rates` — a simple form listing all supported currencies with editable rate fields and a save button.

**Sprint 2 (automated):** A Supabase Edge Function calls `ExchangeRate-API` (free tier, 1,500 req/month) daily. Scheduled via `pg_cron` at midnight UTC. The function upserts all supported currency rows in `fx_rates`.

### Migration

New migration file: `20260613_43_global_currency.sql`
- Add `currency_code text not null default 'ZAR'` to `containers`
- Add `price_per_cbm_usd numeric` to `containers`
- Create `fx_rates` table
- Update `containers` insert/update RLS to allow operators to set `currency_code`

---

## 2. Home Page Updates

### Hero Copy

Change: _"ShareConLoad connects shippers and carriers to move containers smarter"_  
To: _"ShareConLoad connects shippers, operators, and freight agents to move containers smarter across every global route."_

The two existing hero CTA buttons are unchanged (shipper-focused).

### CTA Strip

Replace the single operator CTA strip with a two-column section on the same dark navy (`#0f2044`) background:

| Left column | Right column |
|---|---|
| 🚢 Got container space? List it globally. | 🤝 You're a freight agent? Bring your clients here. |
| Reach verified shippers on every route, fill faster. | Book container space on behalf of your shippers. |
| [I Have Container Space →] → `/onboarding/operator` | [Join as Agent →] → `/onboarding/agent` |

### Footer

Add "Become an Agent" link in the Platform column, below "List Your Container".

### What Does Not Change

Navbar, listings section, trust strip, search form, and mobile drawer are untouched.

---

## 3. How It Works — Agent Section

A new section added between the Operator Journey and the "Why ShareConLoad?" section. Uses the same `StepRow` alternating layout with green accent colour (`#16a34a`) matching the agent portal.

### 5-Step Agent Journey

| Step | Title | Description | Badge |
|------|-------|-------------|-------|
| 1 | Apply & Get Verified | Submit your freight agent application — business registration, forwarder license, and identity documents. ShareConLoad reviews and approves your account before you go live. | One-time vetting |
| 2 | Add Your Client Shippers | Build your client roster on the platform. Each shipper gets their own profile — name, contact, country, and shipping notes. | Unlimited clients |
| 3 | Browse & Book on Their Behalf | Search available containers by route, date, and price. Book space for any of your managed shippers — no need for them to be on the platform. | |
| 4 | Manage Declarations & Tracking | Submit goods declarations, track shipment milestones, and keep your clients informed at every stage. | |
| 5 | Coordinate Cargo Release | Handle final payment, customs clearance confirmation, and cargo release on behalf of your shippers. Bill your clients directly — your fee is outside the platform. | Final 30% triggers release |

### Benefits Card

Added to the "Why ShareConLoad?" grid (becomes 3 columns: Shippers / Operators / Agents):

- Manage unlimited client shippers
- Book space without clients needing accounts
- Centralised tracking across all clients
- Dispute handling on clients' behalf
- Commission-free — bill your clients directly

### CTAs (end of page)

Add "Become an Agent" button alongside the existing "Become an Operator" button in the final CTA section.

---

## 4. Agent Onboarding KYC Flow

### Status Model

`agent_profiles.status` values change from `active / suspended` to:

```
pending_review → approved
             → rejected (with rejection_reason text)
```

An approved agent can access `/agent`. A `pending_review` or `rejected` agent is redirected to the status tracker at `/onboarding/agent/status`.

### Multi-Step Onboarding Flow

All steps are under `/onboarding/agent/`:

**Step 1 — Business Details** (`/onboarding/agent`)
- Business / Agency name (required)
- Contact person full name
- Phone number
- Country of registration
- Operating corridors (multi-select: Africa, Europe, Asia, Americas, Middle East, Global)
- Years in operation
- Brief description of services

**Step 2 — Credentials** (`/onboarding/agent/credentials`)
- Freight forwarder license number (required)
- Issuing authority / country
- License expiry date
- Business registration number

**Step 3 — Document Upload** (`/onboarding/agent/documents`)
- Freight forwarder license (PDF/image, required)
- Business registration certificate (PDF/image, required)
- Identity document of contact person (PDF/image, required)
- Proof of address (PDF/image)
- Uses the same Supabase Storage pattern as operator compliance documents

**Step 4 — Bank Details** (`/onboarding/agent/bank`)
- Bank name
- Account holder name
- Account number
- Branch code / SWIFT / IBAN (conditional on country)
- Stored for future Paystack payout wiring — not yet active

**Step 5 — Review & Submit** (`/onboarding/agent/review`)
- Read-only summary of all entered data
- Checkbox: "I confirm all information is accurate and I agree to the ShareConLoad Agent Terms"
- Submit → sets `agent_profiles.status = 'pending_review'` → redirects to `/onboarding/agent/status`

### Status Tracker (`/onboarding/agent/status`)

Shown whenever an agent with `pending_review` or `rejected` status attempts to access `/agent`.

Visual stepper:
```
Submitted ✓  →  Under Review  →  Approved / Rejected
```

- If `rejected`: displays `rejection_reason` and a "Resubmit Application" button (resets to Step 1)
- Notification sent to user email on status change via existing `notifications` table

### Admin — Agent Management (`/admin/agents`)

New admin page:
- Table listing all agent applications with status badges
- Clicking a row shows full application detail + document download links
- Approve button → sets `status = 'approved'`, fires notification
- Reject button → modal with rejection reason text field → sets `status = 'rejected'`, fires notification

### Migration

New migration: `20260613_44_agent_onboarding_kyc.sql`
- Data migration: `UPDATE agent_profiles SET status = 'approved' WHERE status = 'active'` before altering the constraint
- Alter `agent_profiles.status` check constraint to `('pending_review', 'approved', 'rejected')`
- Add columns: `operating_corridors text[]`, `years_in_operation int`, `service_description text`, `license_number text`, `license_authority text`, `license_expiry date`, `registration_number text`, `bank_name text`, `bank_account_holder text`, `bank_account_number text`, `bank_branch_code text`, `rejection_reason text`
- Update RLS policies to reflect new status values
- Create Supabase Storage bucket `agent-documents` with appropriate policies

---

## 5. Role Management

### RoleSwitcher — "Add a role" entry

Add a divider and "＋ Add a role" link at the bottom of the dropdown. Visible only when the user does not yet hold all three roles (customer, operator, agent). Links to `/onboarding`.

No changes to the existing role-switching logic.

### Context-Aware `/onboarding` Page

On load, authenticated users trigger a profile fetch. The page renders each role card in one of two states:

**Already holds this role:**
- Greyed-out card header with a green ✓ badge
- "You have this role" label
- Button: "Go to [Portal name]" → links to the portal

**Does not yet hold this role:**
- Normal card (full colour)
- Standard join CTA and button

Unauthenticated users always see all three cards in the normal state (no change).

### Role Combination Matrix

| User holds | Onboarding shows |
|---|---|
| Shipper only | Operator card (register) + Agent card (register) |
| Shipper + Operator | Operator card (go to portal) + Agent card (register) |
| Shipper + Agent | Operator card (register) + Agent card (go to portal) |
| Shipper + Operator + Agent | Operator card (go to portal) + Agent card (go to portal) |

The Shipper card always shows "go to bookings" for authenticated users — there is no separate shipper registration (all users are shippers by default).

---

## Database Migration Summary

| File | Changes |
|---|---|
| `20260613_43_global_currency.sql` | Add `currency_code`, `price_per_cbm_usd` to containers; create `fx_rates` table |
| `20260613_44_agent_onboarding_kyc.sql` | Alter `agent_profiles` status, add KYC columns, create `agent-documents` storage bucket |

---

## Out of Scope (this sprint)

- Automated FX rate Edge Function + pg_cron (Sprint 2)
- Paystack payout wiring for agents (future sprint)
- Agent-specific commission tracking through the platform
- Real-time FX conversion at payment time
