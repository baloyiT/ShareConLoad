# FCL / LCL Load Type — Design Spec

**Date:** 2026-06-23
**Status:** Approved for planning
**Author:** Justice Baloyi (with Claude)

---

## 1. Overview

Introduce an explicit **load type** on every container with exactly two mutually
exclusive options:

- **FCL** — Full Container Load. A shipper books the *entire* container for one flat price.
- **LCL** — Less Than Container Load. Shippers book a portion by CBM (the platform's
  current shared-container behavior).

There is **no "Both" option**. An operator who handles both types lists **two separate
containers** — one FCL, one LCL. This avoids the holding conflict where a small LCL
booking sterilizes a container that an incoming FCL shipper would have taken whole.

Search is strictly segregated: **FCL containers never appear in LCL results and vice
versa** when a shipper filters by type.

### Goals
- Operators choose FCL or LCL when listing a container.
- Shippers can filter the marketplace by FCL / LCL (or view all).
- FCL booking = whole container at a flat price, no CBM entry, no CBM variance.
- LCL booking = unchanged (CBM entry, ±5% variance, per-CBM price).
- No cross-type matching.

### Non-goals
- No change to payments, payouts, or commission logic.
- No "convert this container between FCL and LCL" tooling (operator deletes/re-lists).
- No partial FCL (FCL is always all-or-nothing, one shipper).

---

## 2. Data Model

New migration: `supabase/migrations/20260623_NN_container_load_type.sql` (idempotent).

Add to `containers`:

| Column | Type | Notes |
|---|---|---|
| `load_type` | `text NOT NULL DEFAULT 'LCL'` | check `load_type in ('FCL','LCL')` |
| `full_container_price` | `numeric` (nullable) | the flat FCL price, in `currency_code` |
| `full_container_price_usd` | `numeric` (nullable) | USD equivalent, mirrors `price_per_cbm_usd` for cross-currency display/filter |

**Backfill:** all existing rows → `load_type = 'LCL'` (they are per-CBM today). Handled by
the `DEFAULT 'LCL'` plus an explicit `update` for any pre-existing nulls.

**Integrity constraint** (so a row can't be malformed):
```
check (
  (load_type = 'LCL' and price_per_cbm is not null) or
  (load_type = 'FCL' and full_container_price is not null)
)
```
Note: `price_per_cbm` is currently `NOT NULL`. The same migration **relaxes it to
nullable** so FCL rows don't carry a meaningless `0`; the check constraint above guarantees
LCL rows still always have it.

**RLS:** no policy changes — new columns inherit the existing `containers` policies.

---

## 3. Operator Create (`app/operator/create/page.tsx`)

- Add `load_type: 'FCL' | 'LCL'` to `ContainerForm` (default `'LCL'`).
- Add `full_container_price: string` to the form.
- At the top of **Section 3 (Capacity & Pricing)**, a required segmented selector:
  **`[ FCL ]  [ LCL ]`** with helper text:
  *"Offering both? List a separate container for each type."*
- Conditional pricing field:
  - **LCL** → existing **Price per CBM** field (+ USD equiv calc as today).
  - **FCL** → **Full Container Price** field (+ USD equiv via `fxRates`).
- `total_capacity_cbm` remains required for both (FCL uses it for display/manifest and to
  set `available_capacity_cbm` on creation).
- Validation: FCL requires `full_container_price > 0`; LCL requires `price_per_cbm > 0`.
- Insert payload includes `load_type`, and either `full_container_price` (+`_usd`) or
  `price_per_cbm` (+`_usd`) depending on type.

---

## 4. Shipper Search (`app/page.tsx`)

- New filter state `loadTypeFilter: 'all' | 'FCL' | 'LCL'` (default `'all'`).
- Segmented control in the search bar: **All · FCL · LCL**.
- Extend the `filteredContainers` `useMemo`: when `loadTypeFilter !== 'all'`, keep only
  `c.load_type === loadTypeFilter`. Strict, one-way segregation.
- Included in the "Clear filters" reset.

### ContainerCard (`components/ContainerCard.tsx`)
- Extend the `Container` type: `load_type: 'FCL' | 'LCL'`, `full_container_price: number | null`,
  `full_container_price_usd: number | null`.
- Render a small **FCL / LCL badge**.
- Price display:
  - **LCL** → `R{price_per_cbm} / CBM` (current).
  - **FCL** → `R{full_container_price} · whole container`.

---

## 5. Booking Flow (`app/booking/[containerId]/page.tsx`)

Branch on `container.load_type`:

### LCL (unchanged)
CBM input, ±5% CBM variance acknowledgement, CBM declaration modal, per-CBM price,
capacity decrement by booked CBM.

### FCL (new branch)
- **No CBM input** and **no CBM-variance declaration** (the shipper takes the whole box).
- `total_cbm = container.total_capacity_cbm` (auto).
- `total_price = container.full_container_price`.
- `cbm_declaration_type` not applicable → store `'self_declared'` with
  `cbm_disclaimer_acknowledged_count = 0`, or add a sentinel; **Decision:** reuse
  `cbm_declaration_type = 'self_declared'` and skip the disclaimer modal entirely.
- **Goods declaration + shipment items still required** (unchanged, mandatory).
- On submit: set `available_capacity_cbm = 0` and `status = 'full'` (one shipper consumes
  the entire container). This is the holding-conflict fix.
- Order Summary shows "Whole container" instead of a CBM line.

### Shared
KYC gate, declaration, notifications, redirect to `/payments/[bookingId]` — all unchanged.

---

## 6. Pricing, Payments, Commission

No changes. Staged payments are derived from `bookings.total_price`, and commission is
computed from `total_price` converted to USD via `fx_rates`. FCL's flat price flows
through the existing logic unchanged.

---

## 7. Edge Cases

- **FCL re-listing:** an operator who wants to switch a container's type deletes and
  re-creates it. No in-place conversion.
- **FCL double-booking:** because the first FCL booking sets `status = 'full'` and
  `available_capacity_cbm = 0`, the container drops out of open listings, preventing a
  second booking. (Existing booking validation already blocks bookings on non-open
  containers / zero capacity.)
- **Existing in-flight bookings:** unaffected — all existing containers are LCL.
- **Operator dashboard / admin views:** display the badge where containers are listed
  (nice-to-have; not blocking — scope to listing surfaces touched by this work).

---

## 8. Testing

- **Migration:** apply; verify all pre-existing containers are `LCL`; verify the check
  constraint rejects an FCL row with null `full_container_price` and an LCL row with null
  `price_per_cbm`.
- **Operator create:** create one FCL and one LCL container; verify correct columns set.
- **Shipper search:** FCL filter shows only FCL; LCL filter shows only LCL; All shows both.
- **FCL booking:** no CBM input shown; price = full price; on submit container goes
  `full` / `available = 0`; second booking attempt blocked.
- **LCL booking:** unchanged behavior (regression check on CBM + variance + price).
- Extend existing Playwright specs (`tests/booking-flow.spec.ts`) where practical.

---

## 9. Files Touched

- `supabase/migrations/20260623_NN_container_load_type.sql` (new)
- `app/operator/create/page.tsx`
- `app/page.tsx`
- `components/ContainerCard.tsx`
- `app/booking/[containerId]/page.tsx`
- `app/container/[id]/page.tsx` — container detail must show the FCL flat price (not per-CBM) and the badge, since the "Book" CTA originates here
- (display-only badge, optional) `app/operator/page.tsx`
