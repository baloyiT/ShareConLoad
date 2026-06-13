# Global Expansion, Agent Role & Role Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open ShareConLoad to global routes and all Paystack currencies, add a full Agent KYC onboarding flow with admin approval, surface the Agent role on the home page and How It Works, and make role management context-aware.

**Architecture:** Client-side Next.js app with Supabase direct access. All new DB changes go through migration files. Multi-step agent onboarding persists to `agent_profiles` at each step (no client-side state across page loads). FX rates stored in a `fx_rates` DB table, readable by the client.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase (PostgreSQL + Auth + Storage), Server Actions (`'use server'`)

**Note on testing:** This project has no automated test suite. Each task uses `npx tsc --noEmit` as the type-check gate, plus a manual verification step against the running dev server (`npm run dev`).

---

## File Map

**New files:**
- `supabase/migrations/20260613_43_global_currency.sql`
- `supabase/migrations/20260613_44_agent_onboarding_kyc.sql`
- `actions/fxRateActions.ts`
- `actions/adminAgentActions.ts`
- `app/admin/fx-rates/page.tsx`
- `app/admin/agents/page.tsx`
- `app/onboarding/agent/credentials/page.tsx`
- `app/onboarding/agent/documents/page.tsx`
- `app/onboarding/agent/bank/page.tsx`
- `app/onboarding/agent/review/page.tsx`
- `app/onboarding/agent/status/page.tsx`

**Modified files:**
- `supabase/migrations/20260613_44_agent_onboarding_kyc.sql` — new status values + KYC columns
- `actions/agentActions.ts` — multi-step save actions
- `app/agent/layout.tsx` — guard pending/rejected agents
- `app/onboarding/agent/page.tsx` — expanded Step 1
- `app/onboarding/page.tsx` — context-aware role cards
- `app/operator/create/page.tsx` — currency selector + USD equiv
- `components/ContainerCard.tsx` — show USD equiv price
- `components/RoleSwitcher.tsx` — Add a role link
- `app/page.tsx` — hero copy + two-column CTA + filter label
- `app/how-it-works/page.tsx` — Agent journey section + benefits

---

## Task 1: Migration — Global Currency

**Files:**
- Create: `supabase/migrations/20260613_43_global_currency.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260613_43_global_currency.sql

-- FX rates table (1 row per currency, manually updated by admin, automated later)
create table if not exists public.fx_rates (
  currency_code  text primary key,
  rate_to_usd    numeric(18, 8) not null check (rate_to_usd > 0),
  updated_at     timestamptz not null default now()
);

-- Seed with approximate rates (admin will correct these)
insert into public.fx_rates (currency_code, rate_to_usd) values
  ('USD', 1.0),
  ('ZAR', 0.054),
  ('GHS', 0.067),
  ('NGN', 0.00063),
  ('KES', 0.0077),
  ('GBP', 1.27),
  ('EUR', 1.08),
  ('XOF', 0.00165),
  ('EGP', 0.020)
on conflict (currency_code) do nothing;

-- RLS: anyone can read rates (needed client-side when listing containers)
alter table public.fx_rates enable row level security;

drop policy if exists "fx_rates_public_read" on public.fx_rates;
create policy "fx_rates_public_read"
  on public.fx_rates for select
  using (true);

drop policy if exists "fx_rates_admin_write" on public.fx_rates;
create policy "fx_rates_admin_write"
  on public.fx_rates for all
  using (public.is_admin())
  with check (public.is_admin());

-- Add currency fields to containers
alter table public.containers
  add column if not exists currency_code    text not null default 'ZAR',
  add column if not exists price_per_cbm_usd numeric(18, 2);

-- Back-fill existing containers: assume ZAR, compute USD equiv
update public.containers
  set price_per_cbm_usd = round(price_per_cbm * 0.054, 2)
  where currency_code = 'ZAR' and price_per_cbm_usd is null;
```

- [ ] **Step 2: Apply the migration**

Run in Supabase SQL editor or via CLI:
```bash
# If using Supabase CLI:
supabase db push
# Or paste the SQL directly into the Supabase SQL editor and run it.
```

Expected: no errors, `fx_rates` table appears in Supabase table editor with 9 rows.

- [ ] **Step 3: Verify**

In Supabase SQL editor:
```sql
select * from fx_rates;
select currency_code, price_per_cbm, price_per_cbm_usd from containers limit 5;
```

Expected: 9 rate rows; existing containers have `currency_code = 'ZAR'` and a non-null `price_per_cbm_usd`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613_43_global_currency.sql
git commit -m "feat: migration — fx_rates table and container currency fields"
```

---

## Task 2: Migration — Agent KYC Schema

**Files:**
- Create: `supabase/migrations/20260613_44_agent_onboarding_kyc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260613_44_agent_onboarding_kyc.sql

-- Data migration: existing 'active' agents become 'approved'
update public.agent_profiles set status = 'approved' where status = 'active';

-- Drop old check constraint and add new one with all status values
alter table public.agent_profiles
  drop constraint if exists agent_profiles_status_check;

alter table public.agent_profiles
  add constraint agent_profiles_status_check
  check (status in ('draft', 'pending_review', 'approved', 'rejected'));

-- Step 1 extra fields
alter table public.agent_profiles
  add column if not exists operating_corridors  text[]      default '{}',
  add column if not exists years_in_operation   int,
  add column if not exists service_description  text;

-- Step 2: credentials
alter table public.agent_profiles
  add column if not exists license_number       text,
  add column if not exists license_authority    text,
  add column if not exists license_expiry       date,
  add column if not exists registration_number  text;

-- Step 3: document URLs (uploaded to Supabase Storage)
alter table public.agent_profiles
  add column if not exists doc_license_url       text,
  add column if not exists doc_business_reg_url  text,
  add column if not exists doc_identity_url      text,
  add column if not exists doc_proof_address_url text;

-- Step 4: bank details
alter table public.agent_profiles
  add column if not exists bank_name             text,
  add column if not exists bank_account_holder   text,
  add column if not exists bank_account_number   text,
  add column if not exists bank_branch_code      text;

-- Admin rejection
alter table public.agent_profiles
  add column if not exists rejection_reason      text;

-- Storage bucket for agent documents
insert into storage.buckets (id, name, public)
  values ('agent-documents', 'agent-documents', false)
  on conflict (id) do nothing;

-- Storage RLS: agents upload their own docs
drop policy if exists "agents_upload_own_docs" on storage.objects;
create policy "agents_upload_own_docs"
  on storage.objects for insert
  with check (
    bucket_id = 'agent-documents'
    and auth.uid() is not null
  );

drop policy if exists "agents_read_own_docs" on storage.objects;
create policy "agents_read_own_docs"
  on storage.objects for select
  using (
    bucket_id = 'agent-documents'
    and auth.uid() is not null
  );

drop policy if exists "admins_all_agent_docs" on storage.objects;
create policy "admins_all_agent_docs"
  on storage.objects for all
  using (bucket_id = 'agent-documents' and public.is_admin())
  with check (bucket_id = 'agent-documents' and public.is_admin());
```

- [ ] **Step 2: Apply the migration**

Run in Supabase SQL editor. Expected: no errors. Check that `agent_profiles` now has all new columns in the table editor.

- [ ] **Step 3: Verify constraint**

```sql
-- Should succeed
insert into public.agent_profiles (profile_id, business_name, status)
  values ('00000000-0000-0000-0000-000000000000', 'Test', 'draft')
  on conflict do nothing;

-- Should fail with check constraint violation
insert into public.agent_profiles (profile_id, business_name, status)
  values ('00000000-0000-0000-0000-000000000001', 'Test2', 'active');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613_44_agent_onboarding_kyc.sql
git commit -m "feat: migration — agent KYC columns, draft/pending_review status, agent-documents bucket"
```

---

## Task 3: Admin FX Rates Action + Page

**Files:**
- Create: `actions/fxRateActions.ts`
- Create: `app/admin/fx-rates/page.tsx`

- [ ] **Step 1: Write the server action**

```typescript
// actions/fxRateActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

export type FxRate = {
  currency_code: string;
  rate_to_usd: number;
  updated_at: string;
};

export async function updateFxRates(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) return { error: 'Admin access required.' };

  const CURRENCIES = ['USD', 'ZAR', 'GHS', 'NGN', 'KES', 'GBP', 'EUR', 'XOF', 'EGP'];

  const updates = CURRENCIES.map((code) => {
    const raw = formData.get(code) as string;
    const rate = parseFloat(raw);
    return { currency_code: code, rate_to_usd: rate, updated_at: new Date().toISOString() };
  }).filter((u) => !isNaN(u.rate_to_usd) && u.rate_to_usd > 0);

  const { error } = await supabase
    .from('fx_rates')
    .upsert(updates, { onConflict: 'currency_code' });

  if (error) return { error: error.message };

  revalidatePath('/admin/fx-rates');
  return { success: true };
}
```

- [ ] **Step 2: Write the admin FX rates page**

```typescript
// app/admin/fx-rates/page.tsx
'use client';

import { useEffect, useState, useActionState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { updateFxRates, type FxRate } from '@/actions/fxRateActions';

const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'ZAR', label: 'South African Rand (ZAR)' },
  { code: 'GHS', label: 'Ghanaian Cedi (GHS)' },
  { code: 'NGN', label: 'Nigerian Naira (NGN)' },
  { code: 'KES', label: 'Kenyan Shilling (KES)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'XOF', label: 'West African CFA Franc (XOF)' },
  { code: 'EGP', label: 'Egyptian Pound (EGP)' },
];

export default function FxRatesPage() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [state, formAction, isPending] = useActionState(updateFxRates, undefined);

  useEffect(() => {
    supabase
      .from('fx_rates')
      .select('currency_code, rate_to_usd')
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((r: FxRate) => { map[r.currency_code] = r.rate_to_usd; });
          setRates(map);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-extrabold text-gray-900">FX Rates</h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6">
          Rates represent: <strong>1 unit of currency = X USD</strong>. Example: ZAR 0.054 means 1 ZAR = $0.054 USD.
          These rates are used to compute the USD equivalent on container listings.
        </div>

        {state?.error && (
          <div className="alert alert-error text-sm mb-4">{state.error}</div>
        )}
        {state?.success && (
          <div className="alert alert-success text-sm mb-4">Rates updated successfully.</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : (
          <form action={formAction} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
            {CURRENCIES.map(({ code, label }) => (
              <div key={code} className="flex items-center gap-4">
                <label className="w-52 text-sm font-medium text-gray-700 shrink-0">{label}</label>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-400">1 {code} =</span>
                  <input
                    name={code}
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    defaultValue={rates[code] ?? ''}
                    placeholder="0.000000"
                    className="input input-bordered input-sm w-36 text-sm"
                    required
                  />
                  <span className="text-sm text-gray-400">USD</span>
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0f2044' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save Rates'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add FX Rates link to admin nav**

In `app/admin/page.tsx`, find the admin navigation links and add:
```tsx
<Link href="/admin/fx-rates" className="...">FX Rates</Link>
```
(Match the style of existing admin nav links in that file.)

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Verify manually**

Start dev server (`npm run dev`), go to `/admin/fx-rates`. Confirm the 9 currency rows load with their seed values. Change one rate, save, and verify the value persists on reload.

- [ ] **Step 6: Commit**

```bash
git add actions/fxRateActions.ts app/admin/fx-rates/page.tsx app/admin/page.tsx
git commit -m "feat: admin FX rates management page"
```

---

## Task 4: Container Create Form — Currency Selector

**Files:**
- Modify: `app/operator/create/page.tsx`

- [ ] **Step 1: Add currency type and constant**

At the top of the file, after the existing imports, add:

```typescript
const SUPPORTED_CURRENCIES = [
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'XOF', label: 'XOF — West African CFA Franc' },
  { code: 'EGP', label: 'EGP — Egyptian Pound' },
];
```

- [ ] **Step 2: Add currency_code to ContainerForm type and EMPTY_FORM**

```typescript
type ContainerForm = {
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  arrival_date: string;
  total_capacity_cbm: string;
  price_per_cbm: string;
  currency_code: string;      // ← new
};

const EMPTY_FORM: ContainerForm = {
  origin_country: '',
  origin_city: '',
  destination_country: '',
  destination_city: '',
  departure_date: '',
  arrival_date: '',
  total_capacity_cbm: '',
  price_per_cbm: '',
  currency_code: 'ZAR',       // ← new
};
```

- [ ] **Step 3: Add FX rate state and fetcher to the component**

Inside `CreateContainerPage`, after existing `useState` declarations, add:

```typescript
const [fxRates, setFxRates] = useState<Record<string, number>>({});

useEffect(() => {
  supabase
    .from('fx_rates')
    .select('currency_code, rate_to_usd')
    .then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {};
        data.forEach((r: { currency_code: string; rate_to_usd: number }) => {
          map[r.currency_code] = r.rate_to_usd;
        });
        setFxRates(map);
      }
    });
}, []);
```

- [ ] **Step 4: Update handleSubmit to include currency and USD equiv**

Replace the `.insert({...})` call body:

```typescript
const rate = fxRates[form.currency_code] ?? null;
const priceUsd = rate ? Math.round(parseFloat(form.price_per_cbm) * rate * 100) / 100 : null;

const { data, error } = await supabase
  .from('containers')
  .insert({
    operator_id:           user.id,
    origin_country:        form.origin_country.trim(),
    origin_city:           form.origin_city.trim(),
    destination_country:   form.destination_country.trim(),
    destination_city:      form.destination_city.trim(),
    departure_date:        form.departure_date,
    arrival_date:          form.arrival_date || null,
    total_capacity_cbm:    cbm,
    available_capacity_cbm: cbm,
    price_per_cbm:         parseFloat(form.price_per_cbm),
    currency_code:         form.currency_code,
    price_per_cbm_usd:     priceUsd,
    status:                'open',
  })
  .select('id')
  .single();
```

- [ ] **Step 5: Add currency selector to Section 3 (Capacity & Pricing)**

Replace the existing `<Field label="Price per CBM (ZAR)" ...>` block with:

```tsx
<Field
  label="Currency"
  required
>
  <select
    value={form.currency_code}
    onChange={(e) => update('currency_code', e.target.value)}
    className="select select-bordered w-full"
  >
    {SUPPORTED_CURRENCIES.map(({ code, label }) => (
      <option key={code} value={code}>{label}</option>
    ))}
  </select>
</Field>

<Field
  label={`Price per CBM (${form.currency_code})`}
  required
  error={errors.price_per_cbm}
>
  <div className="relative">
    <input
      type="number"
      placeholder="e.g. 150"
      min={0.01}
      step={0.01}
      value={form.price_per_cbm}
      onChange={(e) => update('price_per_cbm', e.target.value)}
      className={`input input-bordered w-full ${errors.price_per_cbm ? 'input-error' : ''}`}
      data-error={errors.price_per_cbm ? 'true' : undefined}
    />
  </div>
  {form.price_per_cbm && fxRates[form.currency_code] && (
    <p className="text-xs text-gray-400 mt-1">
      ≈ USD {(parseFloat(form.price_per_cbm) * fxRates[form.currency_code]).toFixed(2)} / CBM
    </p>
  )}
</Field>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 7: Verify manually**

Go to `/operator/create`. Confirm currency dropdown appears with 9 options. Select GHS, enter a price — confirm the USD equiv hint shows. Submit and verify the new container in Supabase has `currency_code = 'GHS'` and a `price_per_cbm_usd` value.

- [ ] **Step 8: Commit**

```bash
git add app/operator/create/page.tsx
git commit -m "feat: container create form — currency selector and USD equivalent"
```

---

## Task 5: ContainerCard — Show USD Equivalent

**Files:**
- Modify: `components/ContainerCard.tsx`

- [ ] **Step 1: Add new fields to Container type**

```typescript
export type Container = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  arrival_date?: string;
  available_capacity_cbm: number;
  total_capacity_cbm: number;
  price_per_cbm: number;
  currency_code?: string;         // ← new
  price_per_cbm_usd?: number;     // ← new
  status: string;
  operator_name?: string;
  operator_id?: string;
  average_stars?: number;
  review_count?: number;
};
```

- [ ] **Step 2: Replace the price display block**

Find the existing price block (lines 49–54) and replace:

```tsx
<div className="text-right">
  <span className="text-2xl font-bold" style={{ color: '#f97316' }}>
    {container.currency_code ?? 'ZAR'} {container.price_per_cbm.toLocaleString()}
  </span>
  <span className="text-xs text-gray-400 block">/CBM</span>
  {container.price_per_cbm_usd != null && (container.currency_code ?? 'ZAR') !== 'USD' && (
    <span className="text-xs text-gray-400">≈ USD {container.price_per_cbm_usd.toFixed(2)}</span>
  )}
</div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Verify manually**

Browse the home page container listings. Existing ZAR containers should show `ZAR 1800 /CBM` with `≈ USD 97.20` below. USD containers show only the USD price with no equiv line.

- [ ] **Step 5: Commit**

```bash
git add components/ContainerCard.tsx
git commit -m "feat: container card shows local price and USD equivalent"
```

---

## Task 6: Home Page — Filter Label + Hero Copy + Two-Column CTA

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update the price filter label and filter logic**

Find the price filter field (around line 657):
```tsx
<label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
  Max Price / CBM (ZAR)
</label>
```
Change to:
```tsx
<label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
  Max Price / CBM (USD equiv.)
</label>
```

Find the `priceMatch` line in `filteredContainers` (around line 258):
```typescript
const priceMatch = !maxPrice || c.price_per_cbm <= parseFloat(maxPrice);
```
Change to:
```typescript
const priceMatch = !maxPrice || (c.price_per_cbm_usd ?? c.price_per_cbm) <= parseFloat(maxPrice);
```

Also add `price_per_cbm_usd?: number` to the `Container` import (it's already handled by the type change in Task 5).

- [ ] **Step 2: Update hero paragraph copy**

Find (around line 564):
```tsx
<p className="text-gray-300 text-base lg:text-lg mb-8 max-w-lg leading-relaxed">
  ShareConLoad connects shippers and carriers to move containers
  smarter, reduce empty miles, and build a more efficient logistics
  network.
</p>
```
Replace with:
```tsx
<p className="text-gray-300 text-base lg:text-lg mb-8 max-w-lg leading-relaxed">
  ShareConLoad connects shippers, operators, and freight agents to move
  containers smarter across every global route — reducing empty miles and
  building a more efficient logistics network.
</p>
```

- [ ] **Step 3: Replace single operator CTA strip with two-column strip**

Find the entire `{/* ── Operator CTA ── */}` section (around lines 787–814) and replace it:

```tsx
{/* ── Supply-side CTA ──────────────────────────────────────────────── */}
<section style={{ backgroundColor: '#0f2044' }}>
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/10">

    {/* Operator column */}
    <div className="flex items-center gap-4 pb-6 sm:pb-0 sm:pr-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
        style={{ backgroundColor: 'rgba(249,115,22,0.15)' }}
      >
        🚢
      </div>
      <div className="flex-1">
        <p className="text-white font-bold text-lg leading-tight">
          Got container space? List it globally.
        </p>
        <p className="text-gray-400 text-sm mt-1 mb-4">
          Reach verified shippers on every route and fill your container faster.
        </p>
        <Link
          href="/onboarding/operator"
          className="inline-block text-sm font-bold px-6 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: '#f97316' }}
        >
          I Have Container Space →
        </Link>
      </div>
    </div>

    {/* Agent column */}
    <div className="flex items-center gap-4 pt-6 sm:pt-0 sm:pl-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
        style={{ backgroundColor: 'rgba(22,163,74,0.15)' }}
      >
        🤝
      </div>
      <div className="flex-1">
        <p className="text-white font-bold text-lg leading-tight">
          You&apos;re a freight agent? Bring your clients here.
        </p>
        <p className="text-gray-400 text-sm mt-1 mb-4">
          Book container space on behalf of your shippers — all from one portal.
        </p>
        <Link
          href="/onboarding/agent"
          className="inline-block text-sm font-bold px-6 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity whitespace-nowrap"
          style={{ backgroundColor: '#16a34a' }}
        >
          Join as Agent →
        </Link>
      </div>
    </div>

  </div>
</section>
```

- [ ] **Step 4: Add "Become an Agent" to footer Platform links**

Find the footer Platform section (around line 841):
```tsx
<Link href="/onboarding/operator" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">List Your Container</Link>
```
Add after it:
```tsx
<Link href="/onboarding/agent" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Become an Agent</Link>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Verify manually**

Check home page: updated hero copy, two-column CTA strip, new footer link. Enter a USD value in the price filter and confirm filtering works.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: home page — agent CTA strip, global hero copy, USD price filter"
```

---

## Task 7: How It Works — Agent Section

**Files:**
- Modify: `app/how-it-works/page.tsx`

- [ ] **Step 1: Add AGENT_STEPS and AGENT_BENEFITS constants**

After the `OPERATOR_BENEFITS` constant (around line 113), add:

```typescript
const AGENT_STEPS: Step[] = [
  {
    num: 1,
    title: 'Apply & Get Verified',
    desc: 'Submit your freight agent application — business registration, forwarder license, and identity documents. ShareConLoad reviews and approves your account before you go live.',
    badge: 'One-time vetting',
    numColor: '#16a34a',
  },
  {
    num: 2,
    title: 'Add Your Client Shippers',
    desc: 'Build your client roster on the platform. Each shipper gets their own profile — name, contact, country, and shipping notes. No need for clients to create accounts.',
    badge: 'Unlimited clients',
    numColor: '#16a34a',
  },
  {
    num: 3,
    title: 'Browse & Book on Their Behalf',
    desc: 'Search available containers by route, date, and price. Book space for any of your managed shippers directly from the agent portal.',
    numColor: '#16a34a',
  },
  {
    num: 4,
    title: 'Manage Declarations & Tracking',
    desc: 'Submit goods declarations for each booking, track milestones as the shipment progresses, and keep your clients informed at every stage.',
    numColor: '#16a34a',
  },
  {
    num: 5,
    title: 'Coordinate Cargo Release',
    desc: 'Handle final payment, customs clearance confirmation, and cargo release on behalf of your shippers. Bill your clients directly — your fee is outside the platform.',
    badge: 'Final 30% triggers release',
    numColor: '#16a34a',
  },
];

const AGENT_BENEFITS = [
  'Manage unlimited client shippers',
  'Book space without clients needing accounts',
  'Centralised tracking across all clients',
  'Dispute handling on clients’ behalf',
  'Commission-free — bill your clients directly',
];
```

- [ ] **Step 2: Add Agent Journey section**

Find the closing `</section>` of the Operator Journey section (after the `OPERATOR_STEPS.map` block, around line 506). Insert after it:

```tsx
{/* ── Agent Journey ── */}
<section className="py-16 px-4">
  <div className="max-w-3xl mx-auto">
    <span
      className="inline-block text-xs font-extrabold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-full"
      style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
    >
      For Freight Agents
    </span>
    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">
      Manage your clients&apos; shipments in one place
    </h2>
    <p className="text-gray-400 text-sm mb-8">
      Apply once, get verified, then book and track on behalf of unlimited shippers.
    </p>
    <div>
      {AGENT_STEPS.map((step, i) => (
        <StepRow
          key={step.num}
          step={step}
          side={i % 2 === 0 ? 'right' : 'left'}
          spineColor="#16a34a"
          accentColor="#16a34a"
          badgeVariant={step.numColor === '#16a34a' ? 'orange' : 'navy'}
          isFirst={i === 0}
          isLast={i === AGENT_STEPS.length - 1}
        />
      ))}
    </div>
  </div>
</section>
```

Note: the `badgeVariant` prop only accepts `'orange' | 'navy'`. For the agent, use `'orange'` for all badges (green badge styling can be added later if needed).

- [ ] **Step 3: Expand the "Why ShareConLoad?" grid to 3 columns and add Agent card**

Find the grid wrapper in the "Why ShareConLoad?" section:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
```
Change to:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
```

After the Operators card closing `</div>`, add:

```tsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
  <span
    className="inline-block text-xs font-extrabold uppercase tracking-widest mb-1 px-2.5 py-1 rounded-full"
    style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
  >
    Agents
  </span>
  <h3 className="font-extrabold text-gray-900 text-base mt-2 mb-4">
    Grow your freight business
  </h3>
  <ul className="flex flex-col gap-3">
    {AGENT_BENEFITS.map((b) => (
      <BenefitItem key={b} text={b} />
    ))}
  </ul>
</div>
```

- [ ] **Step 4: Add "Become an Agent" button to the final CTA section**

Find the final CTA buttons (around line 568):
```tsx
<Link href="/onboarding/operator" ...>Become an Operator</Link>
```
Add after it:
```tsx
<Link
  href="/onboarding/agent"
  className="px-7 py-3 rounded-xl font-bold text-white text-sm border-2 hover:bg-white/10 transition-colors"
  style={{ borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.15)' }}
>
  Become an Agent
</Link>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Verify manually**

Visit `/how-it-works`. Confirm the Agent Journey section appears between Operator and "Why ShareConLoad?", the benefits grid is now 3 columns, and "Become an Agent" appears in the final CTA.

- [ ] **Step 7: Commit**

```bash
git add app/how-it-works/page.tsx
git commit -m "feat: how-it-works — agent journey section and 3-column benefits"
```

---

## Task 8: Agent Server Actions — Multi-Step Support

**Files:**
- Modify: `actions/agentActions.ts`

- [ ] **Step 1: Rewrite agentActions.ts with per-step save actions**

```typescript
// actions/agentActions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';
import { setActiveSession } from '@/services/session';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateAgentProfile(supabase: Awaited<ReturnType<typeof createServerActionClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (profile) {
    const { data: ap } = await supabase
      .from('agent_profiles')
      .select('id, status')
      .eq('profile_id', profile.id)
      .maybeSingle();
    return { profileId: profile.id, agentProfile: ap };
  }

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({ user_id: userId, role_type: 'agent' })
    .select('id')
    .single();

  if (error || !newProfile) return { profileId: null, agentProfile: null };
  return { profileId: newProfile.id, agentProfile: null };
}

// ─── Step 1: Business Details ──────────────────────────────────────────────────

export async function saveAgentStep1(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { profileId, agentProfile } = await getOrCreateAgentProfile(supabase, user.id);
  if (!profileId) return { error: 'Failed to create profile.' };

  const corridors = formData.getAll('operating_corridors') as string[];

  const payload = {
    profile_id:           profileId,
    business_name:        formData.get('business_name') as string,
    contact_person:       (formData.get('contact_person') as string) || null,
    phone_number:         (formData.get('phone_number') as string) || null,
    country:              (formData.get('country') as string) || 'South Africa',
    operating_corridors:  corridors,
    years_in_operation:   parseInt(formData.get('years_in_operation') as string) || null,
    service_description:  (formData.get('service_description') as string) || null,
    status:               agentProfile?.status === 'approved' ? 'approved' : 'draft',
  };

  const { error } = agentProfile
    ? await supabase.from('agent_profiles').update(payload).eq('profile_id', profileId)
    : await supabase.from('agent_profiles').insert(payload);

  if (error) return { error: error.message };

  await setActiveSession({ profile_id: profileId, role_type: 'agent' });
  redirect('/onboarding/agent/credentials');
}

// ─── Step 2: Credentials ──────────────────────────────────────────────────────

export async function saveAgentStep2(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found. Complete Step 1 first.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({
      license_number:    (formData.get('license_number') as string) || null,
      license_authority: (formData.get('license_authority') as string) || null,
      license_expiry:    (formData.get('license_expiry') as string) || null,
      registration_number: (formData.get('registration_number') as string) || null,
    })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };
  redirect('/onboarding/agent/documents');
}

// ─── Step 3: Document URLs (called after client-side upload) ──────────────────

export async function saveAgentDocUrls(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found. Complete Step 1 first.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({
      doc_license_url:       (formData.get('doc_license_url') as string) || null,
      doc_business_reg_url:  (formData.get('doc_business_reg_url') as string) || null,
      doc_identity_url:      (formData.get('doc_identity_url') as string) || null,
      doc_proof_address_url: (formData.get('doc_proof_address_url') as string) || null,
    })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };
  redirect('/onboarding/agent/bank');
}

// ─── Step 4: Bank Details ─────────────────────────────────────────────────────

export async function saveAgentStep4(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found. Complete Step 1 first.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({
      bank_name:            (formData.get('bank_name') as string) || null,
      bank_account_holder:  (formData.get('bank_account_holder') as string) || null,
      bank_account_number:  (formData.get('bank_account_number') as string) || null,
      bank_branch_code:     (formData.get('bank_branch_code') as string) || null,
    })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };
  redirect('/onboarding/agent/review');
}

// ─── Step 5: Submit for review ────────────────────────────────────────────────

export async function submitAgentApplication(
  _prev: { error: string } | null,
  _formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status: 'pending_review' })
    .eq('profile_id', profile.id);

  if (error) return { error: error.message };

  // Notify via existing notifications table
  await supabase.from('notifications').insert({
    user_id: user.id,
    title:   'Application Submitted',
    message: 'Your freight agent application has been submitted and is under review. We will notify you once a decision has been made.',
    type:    'info',
  }).select().maybeSingle();

  redirect('/onboarding/agent/status');
}

// ─── Switch to agent role ─────────────────────────────────────────────────────

export async function switchToAgent(): Promise<void> {
  const supabase = await createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (profile) {
    await setActiveSession({ profile_id: profile.id, role_type: 'agent' });
    redirect('/agent');
  } else {
    redirect('/onboarding/agent');
  }
}

// ─── Add managed shipper (unchanged) ─────────────────────────────────────────

export async function addManagedShipper(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found.' };

  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!agentProfile) return { error: 'Agent profile not found.' };

  const { error: insertError } = await supabase.from('agent_managed_shippers').insert({
    agent_profile_id: agentProfile.id,
    name:             formData.get('name') as string,
    contact_email:    (formData.get('contact_email') as string) || null,
    contact_phone:    (formData.get('contact_phone') as string) || null,
    country:          (formData.get('country') as string) || null,
    notes:            (formData.get('notes') as string) || null,
  });

  if (insertError) return { error: `Failed to add shipper: ${insertError.message}` };
  redirect('/agent/shippers');
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add actions/agentActions.ts
git commit -m "feat: agent actions — multi-step save, submit for review, draft status"
```

---

## Task 9: Agent Onboarding Step 1 — Expanded Business Details

**Files:**
- Modify: `app/onboarding/agent/page.tsx`

- [ ] **Step 1: Rewrite the page**

```typescript
// app/onboarding/agent/page.tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveAgentStep1 } from '@/actions/agentActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Malaysia', 'Mozambique',
  'Namibia', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe',
].sort((a, b) => a === 'South Africa' ? -1 : b === 'South Africa' ? 1 : a.localeCompare(b));

const CORRIDORS = ['Africa', 'Europe', 'Asia', 'Americas', 'Middle East', 'Global'];

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep1() {
  const [state, formAction, isPending] = useActionState(saveAgentStep1, null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span>
          <span style={{ color: '#f97316' }}>Con</span>
          <span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-white/20 text-white/60'}`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 1 of 5 — Business Details
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Tell us about your agency</h1>
          <p className="text-gray-500 text-sm mb-6">Basic information about your freight agency.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Business / Agency Name <span className="text-red-500">*</span>
              </label>
              <input name="business_name" required className="input input-bordered w-full text-sm" placeholder="e.g. FastTrack Freight Agents" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person</label>
              <input name="contact_person" className="input input-bordered w-full text-sm" placeholder="Full name" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
              <input name="phone_number" type="tel" className="input input-bordered w-full text-sm" placeholder="+27 82 123 4567" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Country of Registration</label>
              <select name="country" className="select select-bordered w-full text-sm">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Years in Operation</label>
              <input name="years_in_operation" type="number" min="0" max="100" className="input input-bordered w-full text-sm" placeholder="e.g. 5" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2">Operating Corridors</label>
              <div className="flex flex-wrap gap-2">
                {CORRIDORS.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" name="operating_corridors" value={c} className="checkbox checkbox-sm checkbox-success" />
                    <span className="text-sm text-gray-700">{c}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Brief Description of Services</label>
              <textarea
                name="service_description"
                className="textarea textarea-bordered w-full text-sm"
                rows={3}
                placeholder="Describe the types of freight you handle and the corridors you specialise in..."
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#16a34a' }}
            >
              {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit
git add app/onboarding/agent/page.tsx
git commit -m "feat: agent onboarding step 1 — expanded business details"
```

---

## Task 10: Agent Onboarding Step 2 — Credentials

**Files:**
- Create: `app/onboarding/agent/credentials/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/onboarding/agent/credentials/page.tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveAgentStep2 } from '@/actions/agentActions';

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep2() {
  const [state, formAction, isPending] = useActionState(saveAgentStep2, null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 1 ? 'bg-green-500 text-white' : i < 1 ? 'bg-white/60 text-gray-700' : 'bg-white/20 text-white/60'}`}>
                {i < 1 ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 2 of 5 — Credentials
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Your freight credentials</h1>
          <p className="text-gray-500 text-sm mb-6">License and registration details for compliance verification.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Freight Forwarder License Number <span className="text-red-500">*</span>
              </label>
              <input name="license_number" required className="input input-bordered w-full text-sm" placeholder="e.g. FF-ZA-2024-00123" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Issuing Authority / Country</label>
              <input name="license_authority" className="input input-bordered w-full text-sm" placeholder="e.g. SAAFF — South Africa" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">License Expiry Date</label>
              <input name="license_expiry" type="date" className="input input-bordered w-full text-sm" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Business Registration Number</label>
              <input name="registration_number" className="input input-bordered w-full text-sm" placeholder="e.g. 2023/123456/07" />
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={isPending}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit
git add app/onboarding/agent/credentials/page.tsx
git commit -m "feat: agent onboarding step 2 — credentials"
```

---

## Task 11: Agent Onboarding Step 3 — Document Upload

**Files:**
- Create: `app/onboarding/agent/documents/page.tsx`

- [ ] **Step 1: Write the page**

This page is a client component that uploads files to Supabase Storage directly, then calls `saveAgentDocUrls` with the resulting URLs.

```typescript
// app/onboarding/agent/documents/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type DocKey = 'doc_license' | 'doc_business_reg' | 'doc_identity' | 'doc_proof_address';

const DOCS: { key: DocKey; label: string; required: boolean }[] = [
  { key: 'doc_license',       label: 'Freight Forwarder License',          required: true },
  { key: 'doc_business_reg',  label: 'Business Registration Certificate',   required: true },
  { key: 'doc_identity',      label: 'Identity Document (Contact Person)',   required: true },
  { key: 'doc_proof_address', label: 'Proof of Address',                    required: false },
];

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep3() {
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(key: DocKey, file: File | undefined) {
    setFiles((prev) => ({ ...prev, [key]: file }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = DOCS.filter((d) => d.required && !files[d.key]);
    if (missing.length > 0) {
      setError(`Please upload: ${missing.map((d) => d.label).join(', ')}`);
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated.'); return; }

      const urls: Partial<Record<string, string>> = {};

      for (const { key } of DOCS) {
        const file = files[key];
        if (!file) continue;
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${key}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('agent-documents')
          .upload(path, file, { upsert: true });
        if (uploadErr) throw new Error(`Upload failed for ${key}: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from('agent-documents').getPublicUrl(path);
        urls[`${key}_url`] = urlData.publicUrl;
      }

      // Save URLs via server action using a form POST
      const formData = new FormData();
      Object.entries(urls).forEach(([k, v]) => { if (v) formData.append(k, v); });

      const { saveAgentDocUrls } = await import('@/actions/agentActions');
      const result = await saveAgentDocUrls(null, formData);
      if (result?.error) { setError(result.error); return; }

      router.push('/onboarding/agent/bank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent/credentials" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 2 ? 'bg-green-500 text-white' : i < 2 ? 'bg-white/60 text-gray-700' : 'bg-white/20 text-white/60'}`}>
                {i < 2 ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 3 of 5 — Documents
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Upload your documents</h1>
          <p className="text-gray-500 text-sm mb-6">PDF or image files. Max 10MB each.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {DOCS.map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(key, e.target.files?.[0])}
                  className="file-input file-input-bordered w-full text-sm"
                />
                {files[key] && (
                  <p className="text-xs text-green-600 mt-1">✓ {files[key]!.name}</p>
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent/credentials" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={uploading}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {uploading ? <span className="loading loading-spinner loading-sm" /> : 'Upload & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit
git add app/onboarding/agent/documents/page.tsx
git commit -m "feat: agent onboarding step 3 — document upload to Supabase Storage"
```

---

## Task 12: Agent Onboarding Steps 4 & 5 — Bank Details and Review

**Files:**
- Create: `app/onboarding/agent/bank/page.tsx`
- Create: `app/onboarding/agent/review/page.tsx`

- [ ] **Step 1: Write bank details page**

```typescript
// app/onboarding/agent/bank/page.tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveAgentStep4 } from '@/actions/agentActions';

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep4() {
  const [state, formAction, isPending] = useActionState(saveAgentStep4, null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent/documents" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 3 ? 'bg-green-500 text-white' : i < 3 ? 'bg-white/60 text-gray-700' : 'bg-white/20 text-white/60'}`}>
                {i < 3 ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 4 of 5 — Bank Details
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Banking information</h1>
          <p className="text-gray-500 text-sm mb-6">Stored securely for future payout setup. Not yet active.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bank Name</label>
              <input name="bank_name" className="input input-bordered w-full text-sm" placeholder="e.g. First National Bank" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Account Holder Name</label>
              <input name="bank_account_holder" className="input input-bordered w-full text-sm" placeholder="As it appears on the account" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Account Number</label>
              <input name="bank_account_number" className="input input-bordered w-full text-sm" placeholder="e.g. 62012345678" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Branch Code / SWIFT / IBAN</label>
              <input name="bank_branch_code" className="input input-bordered w-full text-sm" placeholder="e.g. 250655" />
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent/documents" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={isPending}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Save & Review →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write review & submit page**

```typescript
// app/onboarding/agent/review/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { submitAgentApplication } from '@/actions/agentActions';

type AgentSummary = {
  business_name: string;
  contact_person: string | null;
  phone_number: string | null;
  country: string;
  operating_corridors: string[];
  years_in_operation: number | null;
  service_description: string | null;
  license_number: string | null;
  license_authority: string | null;
  license_expiry: string | null;
  registration_number: string | null;
  doc_license_url: string | null;
  doc_business_reg_url: string | null;
  doc_identity_url: string | null;
  doc_proof_address_url: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
};

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingReview() {
  const [profile, setProfile] = useState<AgentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [state, formAction, isPending] = useActionState(submitAgentApplication, null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('id').eq('user_id', user.id).eq('role_type', 'agent').maybeSingle();
      if (!p) return;
      const { data: ap } = await supabase.from('agent_profiles').select('*').eq('profile_id', p.id).maybeSingle();
      if (ap) setProfile(ap as AgentSummary);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} /></div>;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent/bank" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 4 ? 'bg-green-500 text-white' : 'bg-white/60 text-gray-700'}`}>
                {i < 4 ? '✓' : '5'}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 5 of 5 — Review & Submit
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Review your application</h1>
          <p className="text-gray-500 text-sm mb-6">Check everything before submitting for review.</p>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
          )}

          {profile && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm flex flex-col gap-2 mb-6">
              <Row label="Agency" value={profile.business_name} />
              <Row label="Contact" value={profile.contact_person ?? '—'} />
              <Row label="Country" value={profile.country} />
              <Row label="Corridors" value={profile.operating_corridors?.join(', ') || '—'} />
              <Row label="License No." value={profile.license_number ?? '—'} />
              <Row label="Bank" value={profile.bank_name ?? '—'} />
              <div className="pt-1 flex flex-col gap-1">
                {[
                  { label: 'License doc', url: profile.doc_license_url },
                  { label: 'Business reg', url: profile.doc_business_reg_url },
                  { label: 'Identity doc', url: profile.doc_identity_url },
                ].map(({ label, url }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-gray-500">{label}</span>
                    {url ? <span className="text-green-600 font-medium">✓ Uploaded</span> : <span className="text-red-500">Missing</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-success mt-0.5"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
              />
              <span className="text-sm text-gray-700">
                I confirm all information is accurate and I agree to the{' '}
                <Link href="/terms" className="text-green-600 underline">ShareConLoad Agent Terms</Link>.
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent/bank" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={isPending || !agreed}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[200px] truncate">{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/onboarding/agent/bank/page.tsx app/onboarding/agent/review/page.tsx
git commit -m "feat: agent onboarding steps 4 & 5 — bank details and review/submit"
```

---

## Task 13: Agent Status Tracker + Layout Guard

**Files:**
- Create: `app/onboarding/agent/status/page.tsx`
- Modify: `app/agent/layout.tsx`

- [ ] **Step 1: Write the status tracker page**

```typescript
// app/onboarding/agent/status/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Status = 'draft' | 'pending_review' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<Status, { label: string; color: string; desc: string }> = {
  draft:          { label: 'Draft',        color: '#6b7280', desc: 'Your application is incomplete. Please finish all steps.' },
  pending_review: { label: 'Under Review', color: '#f97316', desc: 'Your application has been submitted and is being reviewed by our team. This typically takes 1–3 business days.' },
  approved:       { label: 'Approved',     color: '#16a34a', desc: 'Your agent account is active. You can now access the Agent Portal.' },
  rejected:       { label: 'Rejected',     color: '#ef4444', desc: 'Your application was not approved. Please review the reason below and resubmit.' },
};

export default function AgentStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).eq('role_type', 'agent').maybeSingle();
      if (!profile) { setLoading(false); return; }
      const { data: ap } = await supabase.from('agent_profiles').select('status, rejection_reason').eq('profile_id', profile.id).maybeSingle();
      if (ap) {
        setStatus(ap.status as Status);
        setRejectionReason(ap.rejection_reason ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} /></div>;

  const cfg = status ? STATUS_CONFIG[status] : null;
  const STEPS_STATUS: { label: string; done: boolean; active: boolean }[] = [
    { label: 'Submitted',    done: status !== null && status !== 'draft', active: false },
    { label: 'Under Review', done: status === 'approved' || status === 'rejected', active: status === 'pending_review' },
    { label: status === 'rejected' ? 'Rejected' : 'Approved', done: status === 'approved', active: status === 'rejected' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl" style={{ backgroundColor: cfg ? `${cfg.color}20` : '#f3f4f6' }}>
            {status === 'approved' ? '✅' : status === 'rejected' ? '❌' : status === 'pending_review' ? '🔍' : '📝'}
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Application Status</h1>
          {cfg && <p className="text-sm font-bold mb-2" style={{ color: cfg.color }}>{cfg.label}</p>}
          {cfg && <p className="text-sm text-gray-500 mb-6">{cfg.desc}</p>}

          {/* Step tracker */}
          <div className="flex items-center justify-center gap-0 mb-6">
            {STEPS_STATUS.map((s, i) => (
              <div key={s.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? 'bg-green-500 text-white' : s.active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span className="text-[10px] text-gray-500 w-16 text-center leading-tight">{s.label}</span>
                </div>
                {i < STEPS_STATUS.length - 1 && (
                  <div className="w-12 h-0.5 bg-gray-200 mx-1 mb-4" />
                )}
              </div>
            ))}
          </div>

          {status === 'rejected' && rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-left mb-4">
              <p className="font-bold mb-1">Reason:</p>
              <p>{rejectionReason}</p>
            </div>
          )}

          {status === 'approved' && (
            <Link href="/agent" className="btn w-full text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>
              Go to Agent Portal →
            </Link>
          )}
          {(status === 'rejected' || status === 'draft') && (
            <Link href="/onboarding/agent" className="btn w-full text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>
              {status === 'rejected' ? 'Resubmit Application' : 'Continue Application'}
            </Link>
          )}
          {status === 'pending_review' && (
            <Link href="/" className="btn btn-ghost w-full rounded-xl text-gray-500">Back to Home</Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the agent layout guard**

```typescript
// app/agent/layout.tsx
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/services/supabaseServer';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) redirect('/onboarding/agent');

  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('status')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!agentProfile || agentProfile.status !== 'approved') {
    redirect('/onboarding/agent/status');
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit
git add app/onboarding/agent/status/page.tsx app/agent/layout.tsx
git commit -m "feat: agent status tracker and portal guard for non-approved agents"
```

---

## Task 14: Admin Agent Management

**Files:**
- Create: `actions/adminAgentActions.ts`
- Create: `app/admin/agents/page.tsx`

- [ ] **Step 1: Write admin agent actions**

```typescript
// actions/adminAgentActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
  return data?.is_admin === true;
}

export async function approveAgent(agentProfileId: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', agentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Agent Application Approved',
      message: 'Congratulations! Your freight agent application has been approved. You can now access the Agent Portal.',
      type:    'success',
    });
  }

  revalidatePath('/admin/agents');
  return {};
}

export async function rejectAgent(agentProfileId: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', agentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Agent Application Update',
      message: `Your freight agent application was not approved. Reason: ${reason}. You may resubmit after addressing the issues.`,
      type:    'warning',
    });
  }

  revalidatePath('/admin/agents');
  return {};
}
```

- [ ] **Step 2: Write the admin agents page**

```typescript
// app/admin/agents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { approveAgent, rejectAgent } from '@/actions/adminAgentActions';

type AgentRow = {
  id: string;
  business_name: string;
  contact_person: string | null;
  country: string;
  status: string;
  rejection_reason: string | null;
  license_number: string | null;
  registration_number: string | null;
  doc_license_url: string | null;
  doc_business_reg_url: string | null;
  doc_identity_url: string | null;
  doc_proof_address_url: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:          { bg: '#f3f4f6', color: '#6b7280' },
  pending_review: { bg: '#fff7ed', color: '#f97316' },
  approved:       { bg: '#f0fdf4', color: '#16a34a' },
  rejected:       { bg: '#fef2f2', color: '#ef4444' },
};

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id, business_name, contact_person, country, status, rejection_reason, license_number, registration_number, doc_license_url, doc_business_reg_url, doc_identity_url, doc_proof_address_url, created_at')
      .order('created_at', { ascending: false });
    setAgents((data ?? []) as AgentRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    setActionLoading(true);
    setActionError(null);
    const { error } = await approveAgent(id);
    if (error) { setActionError(error); } else { setSelected(null); await load(); }
    setActionLoading(false);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setActionError('Rejection reason is required.'); return; }
    setActionLoading(true);
    setActionError(null);
    const { error } = await rejectAgent(id, rejectReason.trim());
    if (error) { setActionError(error); } else { setSelected(null); setRejectReason(''); await load(); }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-extrabold text-gray-900">Agent Applications</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>
        ) : (
          <div className="flex flex-col gap-3">
            {agents.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">No agent applications yet.</div>
            )}
            {agents.map((a) => {
              const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.draft;
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{a.business_name}</p>
                      <p className="text-xs text-gray-400">{a.contact_person ?? '—'} · {a.country} · {new Date(a.created_at).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ backgroundColor: style.bg, color: style.color }}>
                        {a.status.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => { setSelected(a); setRejectReason(''); setActionError(null); }}
                        className="btn btn-sm btn-ghost text-xs"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-extrabold text-gray-900">{selected.business_name}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="flex flex-col gap-2 text-sm mb-4">
              <Row label="Country" value={selected.country} />
              <Row label="Contact" value={selected.contact_person ?? '—'} />
              <Row label="License No." value={selected.license_number ?? '—'} />
              <Row label="Reg. No." value={selected.registration_number ?? '—'} />
              <Row label="Status" value={selected.status} />
              {selected.rejection_reason && <Row label="Prev. Rejection" value={selected.rejection_reason} />}
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Documents</p>
              {[
                { label: 'License', url: selected.doc_license_url },
                { label: 'Business Reg', url: selected.doc_business_reg_url },
                { label: 'Identity', url: selected.doc_identity_url },
                { label: 'Proof of Address', url: selected.doc_proof_address_url },
              ].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs">View</a> : <span className="text-gray-300 text-xs">Not uploaded</span>}
                </div>
              ))}
            </div>

            {actionError && <div className="alert alert-error text-sm mb-3">{actionError}</div>}

            {selected.status !== 'approved' && (
              <>
                <div className="mb-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Rejection Reason (required to reject)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="textarea textarea-bordered w-full text-sm"
                    rows={2}
                    placeholder="Explain why the application is not approved..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={actionLoading}
                    className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(selected.id)}
                    disabled={actionLoading}
                    className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Reject'}
                  </button>
                </div>
              </>
            )}
            {selected.status === 'approved' && (
              <p className="text-center text-sm text-green-600 font-bold">This agent is already approved.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: Add Agents link to admin nav in `app/admin/page.tsx`**

Add alongside the existing admin links:
```tsx
<Link href="/admin/agents">Agent Applications</Link>
```

- [ ] **Step 4: Type-check and commit**

```bash
npx tsc --noEmit
git add actions/adminAgentActions.ts app/admin/agents/page.tsx app/admin/page.tsx
git commit -m "feat: admin agent applications page with approve/reject actions"
```

---

## Task 15: RoleSwitcher — "Add a role" Link

**Files:**
- Modify: `components/RoleSwitcher.tsx`

- [ ] **Step 1: Update the dropdown to add "Add a role" entry**

In the `RoleSwitcher` component, after `const otherRoles = availableRoles.filter((r) => r !== currentRole);`, compute whether the user can add more roles:

```typescript
const ALL_REGISTERABLE: RoleKey[] = ['customer', 'operator', 'agent'];
const canAddRole = ALL_REGISTERABLE.some((r) => !availableRoles.includes(r));
```

In the dropdown JSX (after the `{availableRoles.map(...)}` block), add before the closing `</div>`:

```tsx
{canAddRole && (
  <>
    <div className="border-t border-gray-100 my-1" />
    <Link
      href="/onboarding"
      onClick={() => { setOpen(false); onNavigate?.(); }}
      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
    >
      <span className="text-gray-400">＋</span>
      <span>Add a role</span>
    </Link>
  </>
)}
```

Also add the same in the `flat` variant, after the `{otherRoles.map(...)}` block:

```tsx
{variant === 'flat' && canAddRole && (
  <Link
    href="/onboarding"
    onClick={onNavigate}
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
  >
    ＋ Add a role
  </Link>
)}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit
git add components/RoleSwitcher.tsx
git commit -m "feat: role switcher — Add a role link when user has fewer than 3 roles"
```

---

## Task 16: Context-Aware Onboarding Page

**Files:**
- Modify: `app/onboarding/page.tsx`

- [ ] **Step 1: Rewrite the onboarding page to be context-aware**

```typescript
// app/onboarding/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { switchToCustomer } from '@/actions/operatorActions';

type HeldRole = 'operator' | 'agent';

export default function OnboardingPage() {
  const router = useRouter();
  const [heldRoles, setHeldRoles] = useState<HeldRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setIsAuthed(true);

      const { data } = await supabase
        .from('profiles')
        .select('role_type')
        .eq('user_id', user.id);

      const roles: HeldRole[] = [];
      data?.forEach((p) => {
        if (p.role_type === 'operator') roles.push('operator');
        if (p.role_type === 'agent') roles.push('agent');
      });
      setHeldRoles(roles);
      setLoading(false);
    }
    load();
  }, []);

  const operatorHeld = heldRoles.includes('operator');
  const agentHeld = heldRoles.includes('agent');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-2">
          {isAuthed ? 'Expand your account' : 'How would you like to use ShareConLoad?'}
        </h1>
        <p className="text-gray-400 text-sm mb-10 text-center">
          {isAuthed ? 'Add a new role or switch to an existing one.' : 'You can switch roles any time after setup.'}
        </p>

        {loading ? (
          <div className="flex justify-center py-8"><span className="loading loading-spinner loading-lg text-white" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">

            {/* Operator card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 ${operatorHeld && isAuthed ? 'opacity-80' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fff7ed' }}>🚢</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">I Have Container Space</h2>
                <p className="text-gray-500 text-sm mt-1">List available container space and earn from unused capacity</p>
              </div>
              {operatorHeld && isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <span>✓</span> You have this role
                  </div>
                  <Link
                    href="/operator"
                    className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#e8eef8', color: '#0f2044' }}
                  >
                    Go to Operator Portal
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/onboarding/operator')}
                  className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                  style={{ backgroundColor: '#0f2044' }}
                >
                  {isAuthed ? 'Register as Operator' : 'Join as Space Provider'}
                </button>
              )}
            </div>

            {/* Shipper card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fff7ed' }}>📦</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">I Need Container Space</h2>
                <p className="text-gray-500 text-sm mt-1">Book container space for your cargo quickly and securely</p>
              </div>
              {isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <span>✓</span> You have this role
                  </div>
                  <Link
                    href="/bookings"
                    className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
                  >
                    Go to My Bookings
                  </Link>
                </div>
              ) : (
                <form action={switchToCustomer}>
                  <button type="submit" className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90" style={{ backgroundColor: '#f97316' }}>
                    Continue
                  </button>
                </form>
              )}
            </div>

            {/* Agent card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 ${agentHeld && isAuthed ? 'opacity-80' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#f0fdf4' }}>🤝</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">I Am a Freight Agent</h2>
                <p className="text-gray-500 text-sm mt-1">Manage shippers, book space on their behalf, and coordinate cargo</p>
              </div>
              {agentHeld && isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <span>✓</span> You have this role
                  </div>
                  <Link
                    href="/agent"
                    className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                  >
                    Go to Agent Portal
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/onboarding/agent')}
                  className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {isAuthed ? 'Register as Agent' : 'Join as Agent'}
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and commit**

```bash
npx tsc --noEmit
git add app/onboarding/page.tsx
git commit -m "feat: onboarding page — context-aware role cards for authenticated users"
```

---

## Final Verification

- [ ] **Full type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **End-to-end smoke test**

Start dev server: `npm run dev`

1. **Currency:** Create a new container as an operator, select GHS, set a price. Verify the container card on the home page shows `GHS X /CBM` with `≈ USD Y`.
2. **Home page:** Confirm two-column operator/agent CTA strip, updated hero copy, "Become an Agent" footer link.
3. **How It Works:** Confirm Agent Journey section exists, 3-column benefits grid.
4. **Agent onboarding:** Complete all 5 steps. After submit, confirm redirect to `/onboarding/agent/status` showing "Under Review".
5. **Agent portal guard:** Confirm `/agent` redirects pending agents to the status page.
6. **Admin agents:** Go to `/admin/agents`. Approve the test agent. Confirm they can now access `/agent`.
7. **Role switcher:** Log in as a user with only the shipper role. Confirm "＋ Add a role" appears in the dropdown and links to `/onboarding`.
8. **Context-aware onboarding:** As a shipper+operator, visit `/onboarding`. Confirm Shipper and Operator cards show "You have this role" state. Agent card shows the register button.
9. **FX rates admin:** Go to `/admin/fx-rates`, update a rate, save. Create a container in that currency and verify the USD equiv reflects the new rate.

- [ ] **Final commit**

```bash
git add .
git commit -m "feat: global expansion — multi-currency, agent KYC flow, role management"
```
