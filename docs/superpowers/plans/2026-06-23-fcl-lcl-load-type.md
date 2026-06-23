# FCL / LCL Load Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an exclusive FCL/LCL load type to containers so operators list one type per container, shippers filter strictly by type, and FCL books the whole container at a flat price.

**Architecture:** A new `load_type` column drives conditional behavior across four surfaces (operator create, home search, container detail, booking). LCL keeps today's per-CBM flow untouched; FCL is a new branch that sells the entire container for one flat `full_container_price`.

**Tech Stack:** Next.js (App Router, client components), TypeScript, Tailwind + DaisyUI, Supabase (Postgres + RLS). Spec: `docs/superpowers/specs/2026-06-23-fcl-lcl-load-type-design.md`.

## Global Constraints

- Every schema change is a SQL migration file in `supabase/migrations/`, idempotent, named `YYYYMMDD_NN_short_description.sql`. Commit immediately after creating.
- No `any`. Functional components + hooks only. Tailwind/DaisyUI; brand colors `#0b103a` (navy), `#ff6a00` (orange).
- Two load types only: `'FCL'` and `'LCL'`. No "Both".
- LCL behavior must remain byte-for-byte unchanged for existing flows.
- Verification harness is `npx tsc --noEmit` (the repo has no client unit runner; Playwright E2E lives in `tests/`). Each UI task ends with a passing typecheck.

---

### Task 1: Migration — `load_type` + FCL pricing columns

**Files:**
- Create: `supabase/migrations/20260623_70_container_load_type.sql`

**Interfaces:**
- Produces: `containers.load_type ('FCL'|'LCL')`, `containers.full_container_price numeric|null`, `containers.full_container_price_usd numeric|null`; `containers.price_per_cbm` becomes nullable.

- [ ] **Step 1: Write the migration**

```sql
-- 20260623_70_container_load_type.sql
-- Adds exclusive FCL/LCL load type + flat full-container pricing to containers.

alter table containers add column if not exists load_type text not null default 'LCL';
alter table containers add column if not exists full_container_price numeric;
alter table containers add column if not exists full_container_price_usd numeric;

-- Existing rows are all per-CBM shared containers = LCL.
update containers set load_type = 'LCL' where load_type is null;

-- price_per_cbm is meaningless for FCL; allow null there.
alter table containers alter column price_per_cbm drop not null;

-- Allowed values for load_type.
do $$ begin
  alter table containers add constraint containers_load_type_check
    check (load_type in ('FCL','LCL'));
exception when duplicate_object then null; end $$;

-- A row must carry the price field matching its type.
do $$ begin
  alter table containers add constraint containers_price_by_type_check check (
    (load_type = 'LCL' and price_per_cbm is not null) or
    (load_type = 'FCL' and full_container_price is not null)
  );
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (project `fkhfbifgvebygafsewot`, name `container_load_type`) with the SQL above.

- [ ] **Step 3: Verify schema + backfill**

Run this SQL and confirm: `load_type` exists with default `'LCL'`, both new price columns exist, `price_per_cbm` is nullable, and **zero** rows have a null `load_type`.

```sql
select count(*) as null_load_type from containers where load_type is null;
select column_name, is_nullable, column_default
from information_schema.columns
where table_name = 'containers'
  and column_name in ('load_type','full_container_price','full_container_price_usd','price_per_cbm')
order by column_name;
```
Expected: `null_load_type = 0`; `price_per_cbm` `is_nullable = YES`; `load_type` default `'LCL'::text`.

- [ ] **Step 4: Verify the constraint rejects bad rows**

```sql
-- Should FAIL with check violation (FCL without full price):
insert into containers (operator_id, origin_country, origin_city, destination_country,
  destination_city, departure_date, total_capacity_cbm, available_capacity_cbm,
  currency_code, status, load_type)
values ('00000000-0000-0000-0000-000000000000','x','x','y','y', current_date, 10, 10, 'ZAR','open','FCL');
```
Expected: ERROR `containers_price_by_type_check`. (No row inserted.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260623_70_container_load_type.sql
git commit -m "feat: add container load_type (FCL/LCL) + flat FCL pricing columns"
```

---

### Task 2: `Container` type + `ContainerCard` badge & price

**Files:**
- Modify: `components/ContainerCard.tsx`

**Interfaces:**
- Consumes: `containers.load_type`, `full_container_price`, `full_container_price_usd` (Task 1).
- Produces: extended `Container` type used by `app/page.tsx`, `ContainerList`, booking/detail pages.

- [ ] **Step 1: Extend the `Container` type**

In `components/ContainerCard.tsx`, add three fields to the `Container` type (after `price_per_cbm_usd?`):

```ts
  price_per_cbm_usd?: number;
  load_type: 'FCL' | 'LCL';
  full_container_price?: number | null;
  full_container_price_usd?: number | null;
```

- [ ] **Step 2: Replace the price block with a type-aware version**

Replace the price `<div className="text-right">…</div>` (currently lines ~59-67) with:

```tsx
          <div className="text-right">
            {container.load_type === 'FCL' ? (
              <>
                <span className="text-2xl font-bold" style={{ color: '#ff6a00' }}>
                  {container.currency_code ?? 'ZAR'} {(container.full_container_price ?? 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 block">whole container</span>
                {container.full_container_price_usd != null && (container.currency_code ?? 'ZAR') !== 'USD' && (
                  <span className="text-xs text-gray-400">≈ USD {container.full_container_price_usd.toFixed(2)}</span>
                )}
              </>
            ) : (
              <>
                <span className="text-2xl font-bold" style={{ color: '#ff6a00' }}>
                  {container.currency_code ?? 'ZAR'} {(container.price_per_cbm ?? 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 block">/CBM</span>
                {container.price_per_cbm_usd != null && (container.currency_code ?? 'ZAR') !== 'USD' && (
                  <span className="text-xs text-gray-400">≈ USD {container.price_per_cbm_usd.toFixed(2)}</span>
                )}
              </>
            )}
          </div>
```

- [ ] **Step 3: Add the load-type badge**

In the status badge row, after the `LIVE` badge `<span>…</span>`, add:

```tsx
            <span className="badge badge-sm font-semibold px-2 border"
              style={container.load_type === 'FCL'
                ? { backgroundColor: '#e8eef8', color: '#0b103a', borderColor: '#c7d6ef' }
                : { backgroundColor: '#fff1e8', color: '#b3470a', borderColor: '#ffd2b3' }}>
              {container.load_type}
            </span>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0. (`load_type` is now required on `Container`; Tasks 4/5/6 supply it via `select('*')`. If tsc flags a literal `Container` object elsewhere lacking `load_type`, add it there.)

- [ ] **Step 5: Commit**

```bash
git add components/ContainerCard.tsx
git commit -m "feat: container card shows FCL/LCL badge and type-aware price"
```

---

### Task 3: Operator create — FCL/LCL selector, conditional pricing, insert

**Files:**
- Modify: `app/operator/create/page.tsx`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: containers rows with correct `load_type` + price columns.

- [ ] **Step 1: Extend the form type + empty state**

In `ContainerForm` add `load_type: 'FCL' | 'LCL';` and `full_container_price: string;`. In `EMPTY_FORM` add `load_type: 'LCL',` and `full_container_price: '',`.

- [ ] **Step 2: Update validation**

Replace the `price_per_cbm` validation block in `validate()` with type-aware logic:

```ts
    if (form.load_type === 'LCL') {
      if (!form.price_per_cbm || isNaN(price) || price <= 0) {
        errs.price_per_cbm = 'Enter a valid price greater than 0.';
      }
    } else {
      const fullPrice = parseFloat(form.full_container_price);
      if (!form.full_container_price || isNaN(fullPrice) || fullPrice <= 0) {
        errs.full_container_price = 'Enter a valid full-container price greater than 0.';
      }
    }
```
(Also add `full_container_price?: string` is already covered — `FormErrors` is `Partial<Record<keyof ContainerForm,string>>`, so adding the field to `ContainerForm` covers it.)

- [ ] **Step 3: Build the type-aware insert payload**

Replace the price computation + insert in `handleSubmit`:

```ts
    const cbm = parseFloat(form.total_capacity_cbm);
    const rate = fxRates[form.currency_code] ?? null;
    const isFcl = form.load_type === 'FCL';
    const priceUsd = rate && !isFcl
      ? parseFloat((parseFloat(form.price_per_cbm) * rate).toFixed(2)) : null;
    const fullPriceUsd = rate && isFcl
      ? parseFloat((parseFloat(form.full_container_price) * rate).toFixed(2)) : null;
```

Then in the `.insert({...})` object, replace the `price_per_cbm` / `price_per_cbm_usd` lines with:

```ts
          load_type: form.load_type,
          price_per_cbm: isFcl ? null : parseFloat(form.price_per_cbm),
          price_per_cbm_usd: priceUsd,
          full_container_price: isFcl ? parseFloat(form.full_container_price) : null,
          full_container_price_usd: fullPriceUsd,
```

- [ ] **Step 4: Add the selector + conditional price field UI**

At the top of Section 3 (Capacity & Pricing — the `<Section step="3" …>` block), before the capacity field grid, insert a segmented selector:

```tsx
            <div className="mb-5">
              <label className="block mb-1 text-sm font-semibold text-gray-700">Load Type <span className="text-red-500">*</span></label>
              <p className="text-xs text-gray-400 mb-2">Offering both? List a separate container for each type.</p>
              <div className="flex gap-2">
                {(['LCL','FCL'] as const).map((lt) => (
                  <button key={lt} type="button" onClick={() => update('load_type', lt)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
                    style={form.load_type === lt
                      ? { backgroundColor: '#0b103a', color: '#fff', borderColor: '#0b103a' }
                      : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
                    {lt === 'FCL' ? 'Full Container (FCL)' : 'Shared / Per-CBM (LCL)'}
                  </button>
                ))}
              </div>
            </div>
```

Then make the existing **Price per CBM** field render only for LCL, and add the FCL field. Wrap the current price-per-CBM `<Field …>` in `{form.load_type === 'LCL' && ( … )}`, and add alongside it:

```tsx
              {form.load_type === 'FCL' && (
                <Field label="Full Container Price" required error={errors.full_container_price}>
                  <div className="relative">
                    <input type="number" placeholder="e.g. 25000" min={0.01} step={0.01}
                      value={form.full_container_price}
                      onChange={(e) => update('full_container_price', e.target.value)}
                      className={`input input-bordered w-full pr-16 ${errors.full_container_price ? 'input-error' : ''}`}
                      data-error={errors.full_container_price ? 'true' : undefined} />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                      {form.currency_code}
                    </span>
                  </div>
                </Field>
              )}
```

(`update`, `Field`, `Section` already exist in this file. Note `update`'s signature is `(field: keyof ContainerForm, value: string)` — passing `'load_type'` with `'FCL'|'LCL'` is assignable to `string`, so no signature change needed.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/operator/create/page.tsx
git commit -m "feat: operator create — choose FCL/LCL with type-specific pricing"
```

---

### Task 4: Shipper search — load type filter (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: extended `Container` type (Task 2). The container fetch must return `load_type`/price columns.

- [ ] **Step 1: Confirm the fetch selects new columns**

Find the containers query (around line 145-150, ordered by `departure_date`). If it uses `.select('*')`, no change needed (new columns flow through). If it lists explicit columns, add `load_type, full_container_price, full_container_price_usd`. Verify by reading the `.select(...)` call.

- [ ] **Step 2: Add filter state**

After `const [maxPrice, setMaxPrice] = useState("");` add:

```ts
  const [loadTypeFilter, setLoadTypeFilter] = useState<'all' | 'FCL' | 'LCL'>('all');
```

- [ ] **Step 3: Apply the filter**

In the `filteredContainers` `useMemo`, add a load-type predicate and include it in the returned `&&` chain and the dependency array:

```ts
      const loadTypeMatch = loadTypeFilter === 'all' || c.load_type === loadTypeFilter;
      return originMatch && destMatch && dateMatch && priceMatch && loadTypeMatch;
```
Add `loadTypeFilter` to the `useMemo` dependency array.

- [ ] **Step 4: Add the segmented control to the search form**

Inside the search `<form>` grid (after the Max Price field's `<div>`, before the closing `</div>` of the grid, or as a new full-width row above the buttons), add:

```tsx
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Load Type</label>
            <div className="flex gap-2">
              {(['all','FCL','LCL'] as const).map((lt) => (
                <button key={lt} type="button" onClick={() => setLoadTypeFilter(lt)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
                  style={loadTypeFilter === lt
                    ? { backgroundColor: '#0b103a', color: '#fff', borderColor: '#0b103a' }
                    : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
                  {lt === 'all' ? 'All' : lt}
                </button>
              ))}
            </div>
          </div>
```

- [ ] **Step 5: Reset on Clear filters**

In `handleReset` (the function bound to "Clear filters"), add `setLoadTypeFilter('all');` alongside the other filter resets.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: shipper search filters by FCL/LCL load type"
```

---

### Task 5: Container detail — FCL price + book CTA (`app/container/[id]/page.tsx`)

**Files:**
- Modify: `app/container/[id]/page.tsx`

**Interfaces:**
- Consumes: extended `Container` type. Detail page fetches the container (confirm `select('*')`).

- [ ] **Step 1: Confirm fetch + type**

Read the container fetch in this file. Confirm it uses `.select('*')` (so `load_type` etc. are present) and that the local container variable is typed as `Container`. If it has a local narrower type, add the three new fields.

- [ ] **Step 2: Make the price display type-aware**

Find the price render (around line 229: `R{container.price_per_cbm}` and the example line ~234 `e.g. 5 CBM = R{(container.price_per_cbm * 5)…}`). Wrap so that:
- **FCL**: show `{currency} {full_container_price}` with sublabel "whole container", and **omit** the "e.g. 5 CBM = …" example line.
- **LCL**: unchanged (current per-CBM display + example).

```tsx
{container.load_type === 'FCL' ? (
  <>
    <span className="…existing price classes…">
      {(container.currency_code ?? 'ZAR')} {(container.full_container_price ?? 0).toLocaleString()}
    </span>
    <span className="…existing sublabel classes…">whole container</span>
  </>
) : (
  <>
    {/* existing LCL price markup, incl. "e.g. 5 CBM = R…" example */}
  </>
)}
```
(Use the file's existing class names for the price span/sublabel — copy them from the current markup; the structure above is the conditional wrapper.)

- [ ] **Step 3: Add the badge near the title**

Near the route/title, add an FCL/LCL badge mirroring Task 2 Step 3 (same colors and `{container.load_type}` text).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/container/[id]/page.tsx"
git commit -m "feat: container detail shows FCL flat price and load-type badge"
```

---

### Task 6: Booking flow — FCL branch (`app/booking/[containerId]/page.tsx`)

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

**Interfaces:**
- Consumes: `container.load_type`, `container.full_container_price`. Container is fetched via `.select('*')` (confirmed line 109-113).
- Produces: bookings with `total_price` = flat price for FCL; container set to `full` on FCL booking.

- [ ] **Step 1: Add an `isFcl` derived flag**

After the `container` is available (in the Derived values section, ~line 189), add:

```ts
  const isFcl = container?.load_type === 'FCL';
```
(Place where `container` is in scope; in the render-time derived block `container` may be null, so guard with `?.`.)

- [ ] **Step 2: Compute FCL price/CBM in derived values**

Adjust `cbmValue` and `estimatedTotal` so FCL uses the whole container:

```ts
  const cbmValue = isFcl
    ? (container?.total_capacity_cbm ?? 0)
    : (parseFloat(totalCbm) || 0);
  const estimatedTotal = isFcl
    ? (container?.full_container_price ?? 0)
    : (container ? cbmValue * container.price_per_cbm : 0);
```

- [ ] **Step 3: Skip CBM validation for FCL**

In `validate()`, wrap the `total_cbm` checks so they only run for LCL:

```ts
    if (!isFcl) {
      if (!totalCbm || cbmValue <= 0) {
        errs.total_cbm = 'Enter the CBM you need (must be greater than 0).';
      } else if (container && cbmValue > container.available_capacity_cbm) {
        errs.total_cbm = `Only ${container.available_capacity_cbm} CBM is available.`;
      }
    }
```
The `agreed_terms` and item validations stay unchanged (still required).

- [ ] **Step 4: Skip the CBM declaration modal for FCL in `handleSubmit`**

In `handleSubmit`, the self-declared CBM step-1 ack and modal gate are LCL-only. Guard them:

```ts
    if (!isFcl && cbmDeclarationType === 'self_declared' && !cbmStep1Ack) {
      errs.cbm_step1 = 'You must check the CBM accuracy acknowledgement.';
    }
    // …after error check & setErrors({})…
    if (!isFcl && cbmDeclarationType === 'self_declared') {
      setShowCbmModal(true);
      return;
    }
    await performSubmit();
```

- [ ] **Step 5: FCL booking insert + capacity in `performSubmit`**

The booking insert already uses `cbmValue` (now full capacity for FCL) and `estimatedTotal` (flat price). For FCL, set the container to full instead of decrementing:

Replace the Step 4 capacity update with:

```ts
      // ── Step 4: Reduce capacity (LCL) or consume whole container (FCL) ──
      const { error: capacityError } = await supabase
        .from('containers')
        .update(isFcl
          ? { available_capacity_cbm: 0, status: 'full' }
          : { available_capacity_cbm: container!.available_capacity_cbm - cbmValue })
        .eq('id', containerId);
      if (capacityError) throw capacityError;
```

- [ ] **Step 6: Hide CBM Declaration section + CBM input for FCL in the render**

Wrap Section 2 (CBM Declaration) and Section 3 (the CBM Required input) so they render only when `!isFcl`. For FCL, add a short static notice in place of the CBM input:

```tsx
{isFcl ? (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
    <h2 className="font-bold text-gray-800 mb-1">Full Container Booking</h2>
    <p className="text-sm text-gray-500">
      You are booking the entire container ({container.total_capacity_cbm} CBM) for a flat price of{' '}
      {(container.currency_code ?? 'ZAR')} {(container.full_container_price ?? 0).toLocaleString()}.
    </p>
  </section>
) : (
  <>
    {/* existing Section 2 (CBM Declaration) + Section 3 (CBM Required) */}
  </>
)}
```

- [ ] **Step 7: Order Summary — "Whole container" for FCL**

In the right-column Order Summary, replace the "Space requested" `SummaryRow` value so FCL shows `Whole container` instead of a CBM figure:

```tsx
                <SummaryRow
                  label={isFcl ? 'Booking' : 'Space requested'}
                  value={isFcl ? 'Whole container' : (cbmValue > 0 ? `${cbmValue} CBM` : '—')}
                />
```
Also in the status indicators, the "CBM entered" `StatusRow` should be considered satisfied for FCL:

```tsx
                <StatusRow ok={isFcl || cbmValue > 0} label={isFcl ? 'Whole container selected' : 'CBM entered'} />
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 9: Manual verification (dev)**

Create one FCL and one LCL container as an operator. As a shipper:
- FCL booking page shows the "Full Container Booking" notice, no CBM input, Order Summary "Whole container", total = flat price.
- Submit → `bookings.total_price` = flat price, `containers.status = 'full'`, `available_capacity_cbm = 0`.
- LCL booking page unchanged (CBM input, variance modal, per-CBM price).

```sql
select b.total_cbm, b.total_price, c.load_type, c.status, c.available_capacity_cbm
from bookings b join containers c on c.id = b.container_id
order by b.created_at desc limit 2;
```

- [ ] **Step 10: Commit**

```bash
git add "app/booking/[containerId]/page.tsx"
git commit -m "feat: FCL booking books whole container at flat price; LCL unchanged"
```

---

## Self-Review

**Spec coverage:**
- §2 Data model → Task 1 ✓ (load_type, full_container_price[_usd], backfill, nullable price_per_cbm, both check constraints).
- §3 Operator create → Task 3 ✓ (selector, conditional field, validation, insert).
- §4 Shipper search + ContainerCard → Task 4 (filter) + Task 2 (badge/price) ✓.
- §5 Booking flow (FCL/LCL branches) → Task 6 ✓.
- §6 Pricing/commission unchanged → no task needed (verified: booking.total_price drives existing logic) ✓.
- §7 Edge cases: FCL double-booking prevented via `status='full'` (Task 6 Step 5); existing bookings unaffected (all LCL via Task 1 backfill) ✓.
- Container detail (§9 files) → Task 5 ✓.

**Placeholder scan:** All code steps contain concrete code. Task 5 Step 2 intentionally says "copy existing class names" because the conditional wrapper reuses the file's current markup — the engineer reads the adjacent lines; this is not a logic placeholder.

**Type consistency:** `load_type: 'FCL' | 'LCL'` used identically across Tasks 2/3/4/6. `full_container_price` typed `number | null` on `Container` (Task 2) and written as `parseFloat | null` (Task 3). `isFcl` derived consistently in Task 6. Filter state union `'all'|'FCL'|'LCL'` matches the predicate in Task 4.
