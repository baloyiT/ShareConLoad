# Phase 3: Pickup & Drop-off Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end Pickup & Drop-off service — shippers can book a transporter to collect cargo from their location and deliver it to the operator's warehouse, paying via Paystack, with the transporter receiving 85% of the quoted fee on delivery confirmation.

**Architecture:** Client-side Next.js pages + Supabase direct queries + 3 new Edge Functions for Paystack API calls. All Paystack operations (initialize, verify, payout) happen server-side in Edge Functions. Frontend only receives `authorization_url` and redirects. Storage is not required for this phase.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase (PostgreSQL + Auth + Edge Functions), Paystack

---

## File Map

**New migrations:**
- `supabase/migrations/20260614_60_pickup_service_tables.sql` — 3 tables + RLS

**New Edge Functions:**
- `supabase/functions/initialize-pickup-payment/index.ts`
- `supabase/functions/verify-pickup-payment/index.ts`
- `supabase/functions/trigger-transporter-payout/index.ts`

**New pages:**
- `app/transporter/jobs/page.tsx` — Transporter: list of assigned pickup jobs
- `app/transporter/jobs/[id]/page.tsx` — Transporter: job detail with Confirm Collection + Confirm Delivery
- `app/pickup/[bookingId]/page.tsx` — Shipper: request pickup after booking (3-step flow)
- `app/admin/pickup-jobs/page.tsx` — Admin: list all pickup jobs, cancel jobs

**Modified pages:**
- `app/admin/rate-bands/page.tsx` — Add transporter rate bands tab (alongside existing measurement tab)
- `app/transporter/page.tsx` — Replace "Coming Soon" with real job counts + link to /transporter/jobs
- `app/admin/page.tsx` — Add "Pickup Jobs" tile to Operations grid
- `app/bookings/page.tsx` — Add "Arrange Pickup" link on bookings with confirmed Stage 1 payment

---

## Key Business Rules

- **Status lifecycle:** `pending_selection → pending_payment → paid → assigned → collected → delivered` (or `cancelled` from any stage)
- **Transporter matching:** `approved` + `base_city = pickup_city` (case-insensitive) + `vehicle_capacity_cbm >= total_cbm`, ordered by `average_rating DESC`, top 3 shown
- **Fee calculation:** `base_fee + (per_cbm_fee × total_cbm)` from matching `transporter_rate_bands` row
- **Payout:** 85% of `quoted_fee` to transporter; triggered on "Confirm Delivery"
- **Payout gating:** `payout_enabled = true`, `payout_hold = false`, `paystack_recipient_code` set, job status = `delivered`
- **Skip option:** Shipper can skip pickup — no `pickup_job` created, booking continues with self drop-off
- **Paystack reference format:** `SCL-PKP-{jobId[0:8]}-{timestamp}` for payment; `SCL-TPAY-{jobId[0:8]}-{timestamp}` for payout transfer

---

## Task 1: DB Migration — Pickup Service Tables

**Files:**
- Create: `supabase/migrations/20260614_60_pickup_service_tables.sql`

- [ ] **Step 1: Write the migration**

Apply via `mcp__plugin_supabase_supabase__apply_migration` with project_id `fkhfbifgvebygafsewot`, name `20260614_60_pickup_service_tables`, then save the file.

```sql
-- supabase/migrations/20260614_60_pickup_service_tables.sql

-- transporter_rate_bands
create table if not exists transporter_rate_bands (
  id                uuid primary key default gen_random_uuid(),
  zone_name         text not null,
  origin_city       text not null,
  origin_country    text not null,
  base_fee          numeric not null check (base_fee > 0),
  per_cbm_fee       numeric not null default 0 check (per_cbm_fee >= 0),
  vehicle_type      text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

alter table transporter_rate_bands enable row level security;

drop policy if exists "admin_all_transporter_rate_bands" on transporter_rate_bands;
create policy "admin_all_transporter_rate_bands" on transporter_rate_bands
  for all using ((select is_admin()));

drop policy if exists "authenticated_select_active_transporter_rate_bands" on transporter_rate_bands;
create policy "authenticated_select_active_transporter_rate_bands" on transporter_rate_bands
  for select using (active = true and auth.role() = 'authenticated');

-- pickup_jobs
create table if not exists pickup_jobs (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id),
  shipper_profile_id          uuid not null references profiles(id),
  transporter_profile_id      uuid references transporter_profiles(id),
  pickup_address              text not null,
  pickup_city                 text not null,
  pickup_country              text not null,
  warehouse_address           text not null,
  total_cbm                   numeric,
  total_weight_kg             numeric,
  quoted_fee                  numeric not null check (quoted_fee > 0),
  status                      text not null default 'pending_selection'
                                check (status in ('pending_selection','pending_payment','paid','assigned','collected','delivered','cancelled')),
  shortlisted_transporter_ids uuid[],
  payment_ref                 text,
  selected_at                 timestamptz,
  collected_at                timestamptz,
  delivered_at                timestamptz,
  payout_released_at          timestamptz,
  created_at                  timestamptz not null default now()
);

alter table pickup_jobs enable row level security;

drop policy if exists "shipper_select_own_pickup_jobs" on pickup_jobs;
create policy "shipper_select_own_pickup_jobs" on pickup_jobs
  for select using (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "shipper_insert_pickup_jobs" on pickup_jobs;
create policy "shipper_insert_pickup_jobs" on pickup_jobs
  for insert with check (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "transporter_select_assigned_pickup_jobs" on pickup_jobs;
create policy "transporter_select_assigned_pickup_jobs" on pickup_jobs
  for select using (
    transporter_profile_id in (
      select tp.id from transporter_profiles tp
      join profiles p on p.id = tp.profile_id
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "admin_all_pickup_jobs" on pickup_jobs;
create policy "admin_all_pickup_jobs" on pickup_jobs
  for all using ((select is_admin()));

-- pickup_job_payments
create table if not exists pickup_job_payments (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null unique references pickup_jobs(id),
  paystack_ref   text,
  amount         numeric not null check (amount > 0),
  status         text not null default 'pending'
                   check (status in ('pending','paid','refunded','failed')),
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

alter table pickup_job_payments enable row level security;

drop policy if exists "admin_all_pickup_job_payments" on pickup_job_payments;
create policy "admin_all_pickup_job_payments" on pickup_job_payments
  for all using ((select is_admin()));

drop policy if exists "shipper_select_own_pickup_payments" on pickup_job_payments;
create policy "shipper_select_own_pickup_payments" on pickup_job_payments
  for select using (
    job_id in (
      select id from pickup_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );
```

- [ ] **Step 2: Save the file**

Write the SQL to `supabase/migrations/20260614_60_pickup_service_tables.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614_60_pickup_service_tables.sql
git commit -m "feat: add pickup service DB tables — transporter_rate_bands, pickup_jobs, pickup_job_payments"
```

---

## Task 2: Edge Function — initialize-pickup-payment

**Files:**
- Create: `supabase/functions/initialize-pickup-payment/index.ts`

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/initialize-pickup-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { jobId, callbackUrl } = await req.json();
    if (!jobId || !callbackUrl) {
      return new Response(JSON.stringify({ error: 'jobId and callbackUrl are required' }), { status: 400, headers: CORS });
    }

    // Verify caller owns the job
    const { data: job } = await supabase
      .from('pickup_jobs')
      .select('id, quoted_fee, status, shipper_profile_id')
      .eq('id', jobId)
      .single();

    if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: CORS });
    if (job.status !== 'pending_payment') {
      return new Response(JSON.stringify({ error: `Job is not in pending_payment state (current: ${job.status})` }), { status: 400, headers: CORS });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', job.shipper_profile_id)
      .single();

    if (!profile) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS });

    // Get user email for Paystack
    const { data: { user: fullUser } } = await supabase.auth.admin.getUserById(user.id);
    const email = fullUser?.email ?? 'noreply@shareconload.com';

    const reference = `SCL-PKP-${jobId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const amountKobo = Math.round(job.quoted_fee * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        callback_url: callbackUrl,
        metadata: { job_id: jobId, service: 'pickup' },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status || !paystackData.data?.authorization_url) {
      return new Response(JSON.stringify({ error: 'Paystack initialization failed' }), { status: 502, headers: CORS });
    }

    // Store payment_ref and upsert payment record
    await supabase.from('pickup_jobs').update({ payment_ref: reference }).eq('id', jobId);
    await supabase.from('pickup_job_payments').upsert({
      job_id: jobId,
      paystack_ref: reference,
      amount: job.quoted_fee,
      status: 'pending',
    }, { onConflict: 'job_id' });

    await supabase.from('audit_logs').insert({
      action: 'pickup_job.payment_initialized',
      target_type: 'pickup_job',
      target_id: jobId,
      metadata: { reference, amount: job.quoted_fee },
    });

    return new Response(
      JSON.stringify({ authorization_url: paystackData.data.authorization_url, reference }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('initialize-pickup-payment error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: CORS });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/initialize-pickup-payment/index.ts
git commit -m "feat: add initialize-pickup-payment Edge Function"
```

---

## Task 3: Edge Function — verify-pickup-payment

**Files:**
- Create: `supabase/functions/verify-pickup-payment/index.ts`

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/verify-pickup-payment/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { reference } = await req.json();
    if (!reference) return new Response(JSON.stringify({ error: 'reference is required' }), { status: 400, headers: CORS });

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Payment not successful' }), { status: 400, headers: CORS });
    }

    // Find the job
    const { data: job } = await supabase
      .from('pickup_jobs')
      .select('id, transporter_profile_id')
      .eq('payment_ref', reference)
      .single();

    if (!job) return new Response(JSON.stringify({ error: 'Job not found for this reference' }), { status: 404, headers: CORS });

    // Update payment and job status
    await supabase.from('pickup_job_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('job_id', job.id);

    await supabase.from('pickup_jobs')
      .update({ status: 'assigned' })
      .eq('id', job.id);

    // Notify assigned transporter
    if (job.transporter_profile_id) {
      const { data: tp } = await supabase
        .from('transporter_profiles')
        .select('profile_id')
        .eq('id', job.transporter_profile_id)
        .single();
      if (tp) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', tp.profile_id)
          .single();
        if (profile) {
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'pickup_job_assigned',
            title: 'New pickup job assigned',
            body: 'A pickup job has been assigned to you. Check your jobs.',
            metadata: { job_id: job.id },
          });
        }
      }
    }

    // Admin notification
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'pickup_payment_received',
      title: 'Pickup payment received',
      body: `Payment confirmed for pickup job. Reference: ${reference}`,
      metadata: { job_id: job.id, reference },
    });

    await supabase.from('audit_logs').insert({
      action: 'pickup_job.payment_verified',
      target_type: 'pickup_job',
      target_id: job.id,
      metadata: { reference },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('verify-pickup-payment error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: CORS });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/verify-pickup-payment/index.ts
git commit -m "feat: add verify-pickup-payment Edge Function"
```

---

## Task 4: Edge Function — trigger-transporter-payout

**Files:**
- Create: `supabase/functions/trigger-transporter-payout/index.ts`

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/trigger-transporter-payout/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSPORTER_SHARE = 0.85;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });

    const { jobId } = await req.json();
    if (!jobId) return new Response(JSON.stringify({ error: 'jobId is required' }), { status: 400, headers: CORS });

    // Load job
    const { data: job } = await supabase
      .from('pickup_jobs')
      .select('id, status, quoted_fee, transporter_profile_id')
      .eq('id', jobId)
      .single();

    if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: CORS });
    if (job.status !== 'delivered') {
      return new Response(JSON.stringify({ error: `Job must be delivered (current: ${job.status})` }), { status: 400, headers: CORS });
    }
    if (!job.transporter_profile_id) {
      return new Response(JSON.stringify({ error: 'No transporter assigned' }), { status: 400, headers: CORS });
    }

    // Load transporter payout eligibility
    const { data: tp } = await supabase
      .from('transporter_profiles')
      .select('payout_enabled, payout_hold, paystack_recipient_code')
      .eq('id', job.transporter_profile_id)
      .single();

    if (!tp) return new Response(JSON.stringify({ error: 'Transporter profile not found' }), { status: 404, headers: CORS });
    if (!tp.payout_enabled) return new Response(JSON.stringify({ error: 'Payout not enabled for this transporter' }), { status: 400, headers: CORS });
    if (tp.payout_hold) return new Response(JSON.stringify({ error: 'Payout is on hold for this transporter' }), { status: 400, headers: CORS });
    if (!tp.paystack_recipient_code) return new Response(JSON.stringify({ error: 'Transporter has no Paystack recipient code' }), { status: 400, headers: CORS });

    const netAmount = job.quoted_fee * TRANSPORTER_SHARE;
    const amountKobo = Math.round(netAmount * 100);
    const transferRef = `SCL-TPAY-${jobId.slice(0, 8).toUpperCase()}-${Date.now()}`;

    const paystackRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountKobo,
        recipient: tp.paystack_recipient_code,
        reason: `ShareConLoad pickup job payout — ${jobId.slice(0, 8)}`,
        reference: transferRef,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return new Response(JSON.stringify({ error: paystackData.message ?? 'Transfer failed' }), { status: 502, headers: CORS });
    }

    await supabase.from('pickup_jobs')
      .update({ payout_released_at: new Date().toISOString() })
      .eq('id', jobId);

    await supabase.from('audit_logs').insert({
      action: 'transporter.payout_triggered',
      target_type: 'pickup_job',
      target_id: jobId,
      metadata: { transfer_ref: transferRef, amount: netAmount, gross: job.quoted_fee },
    });

    return new Response(
      JSON.stringify({ success: true, transfer_ref: transferRef, amount: netAmount }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('trigger-transporter-payout error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: CORS });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/trigger-transporter-payout/index.ts
git commit -m "feat: add trigger-transporter-payout Edge Function (85% transporter share)"
```

---

## Task 5: Transporter — Jobs List Page

**Files:**
- Create: `app/transporter/jobs/page.tsx`

- [ ] **Step 1: Write the page**

Three-guard auth: user → `role_type = 'transporter'` → `transporter_profiles.status = 'approved'`.

Lists `pickup_jobs` where `transporter_profile_id = transporterProfile.id`, ordered by `created_at DESC`.

Status badges:
- `assigned`: blue (`#eff6ff` / `#2563eb`)
- `collected`: purple (`#f5f3ff` / `#7c3aed`)
- `delivered`: green (`#f0fdf4` / `#16a34a`)
- `cancelled`: gray (`#f3f4f6` / `#6b7280`)

Each card is a `Link` to `/transporter/jobs/[id]`. Show: pickup_city, pickup_country, quoted_fee (ZAR formatted), status badge, created_at.

Empty state: "No pickup jobs assigned yet."

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/transporter/jobs/page.tsx
git commit -m "feat: add transporter jobs list page"
```

---

## Task 6: Transporter — Job Detail Page

**Files:**
- Create: `app/transporter/jobs/[id]/page.tsx`

- [ ] **Step 1: Write the page**

Auth guard same as Task 5 — must be approved transporter, job must be assigned to this transporter's profile.

Load `pickup_jobs` by id, confirm `transporter_profile_id` matches.

**UI sections:**
1. Job details card: pickup_address, pickup_city, pickup_country, warehouse_address, total_cbm, total_weight_kg, quoted_fee
2. Status progress bar (4 steps: Assigned → Collected → Delivered — same dot pattern as Phase 2 tracking page)
3. Action buttons:
   - When `status = 'assigned'`: "Confirm Collection" button → updates `pickup_jobs.status = 'collected'`, `collected_at = now()`; notifies shipper via `notifications` insert with their `user_id`
   - When `status = 'collected'`: "Confirm Delivery" button → updates `pickup_jobs.status = 'delivered'`, `delivered_at = now()`; calls `trigger-transporter-payout` Edge Function (best-effort, non-blocking); notifies operator (look up `bookings.operator_id` → `profiles.user_id`)
   - When `status = 'delivered'`: green success card showing payout triggered

Shipper notification on collection — need shipper's user_id via `pickup_jobs.shipper_profile_id → profiles.user_id`.

Operator notification on delivery — `pickup_jobs.booking_id → bookings.operator_id` (which is an `operator_profiles.id`) → `operator_profiles.profile_id → profiles.user_id`.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/transporter/jobs/[id]/page.tsx"
git commit -m "feat: add transporter job detail page with collection and delivery confirmation"
```

---

## Task 7: Shipper — Pickup Request Flow

**Files:**
- Create: `app/pickup/[bookingId]/page.tsx`

- [ ] **Step 1: Write the page**

3-step flow: `'address' | 'select' | 'paying'`

Also handles `?verify=1` on return from Paystack — calls `verify-pickup-payment` Edge Function.

**Step 'address':**
- Loads booking: `bookings.total_cbm`, `bookings.total_price`, plus container for `warehouse_address` (from `containers.origin_city` + address field if available — use `operator_warehouse_address` or `containers.origin_city + ', ' + containers.origin_country` as fallback)
- Form: `pickupAddress` (text), `pickupCity` (text), `pickupCountry` (text)
- On submit: looks up `transporter_rate_bands` where `active = true`, case-insensitive city match; calculates `fee = base_fee + per_cbm_fee * total_cbm`; loads matching transporters (`approved`, `base_city` match, `vehicle_capacity_cbm >= total_cbm`), sorts by `average_rating DESC`, takes top 3
- If no rate band for city: show error "No pickup service available in {city} yet."
- If rate band found but no transporters: show "No transporters available in {city} right now."
- On success: move to `'select'` step

**Step 'select':**
- Shows fee breakdown (base_fee + per_cbm surcharge if applicable)
- Lists up to 3 transporters: full_name, vehicle_type, vehicle_capacity_cbm, average_rating (or "New"), total_jobs_completed
- Radio-style select card for each transporter
- "Skip — I'll drop it off myself" link → navigates away without creating a job
- "Confirm & Pay" button → creates `pickup_jobs` row (status: `pending_payment`, shortlisted_transporter_ids, transporter_profile_id set to selected), calls `initialize-pickup-payment` Edge Function, redirects browser to `authorization_url`
- Move to `'paying'` step while redirecting

**Step 'paying':**
- Loading spinner + "Redirecting to payment…"

**Verify flow (when `?verify=1`):**
- Before showing the main UI, if `?verify=1`, load job's `payment_ref`, call `verify-pickup-payment`, show success/error banner

Use `Suspense` wrapper for `useSearchParams`.

Warehouse address: query `bookings.container_id → containers`, use `origin_city + ', ' + origin_country` as warehouse_address since no dedicated warehouse_address column exists.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/pickup/[bookingId]/page.tsx"
git commit -m "feat: add shipper pickup request flow with transporter selection and Paystack payment"
```

---

## Task 8: Admin — Pickup Jobs Page

**Files:**
- Create: `app/admin/pickup-jobs/page.tsx`

- [ ] **Step 1: Write the page**

Standard admin guard (is_admin check on mount).

Load `pickup_jobs` with joins:
```typescript
supabase
  .from('pickup_jobs')
  .select(`
    *,
    bookings(id),
    transporter_profiles(full_name)
  `)
  .order('created_at', { ascending: false })
```

Table columns: Job ID (truncated), Pickup City, Booking ID (truncated), Transporter (or "Unassigned"), Fee, Status badge, Created, Actions.

Actions column: "Cancel" button — only shown for non-delivered, non-cancelled jobs. Cancels by updating `pickup_jobs.status = 'cancelled'`.

Status badges (same colors as Task 5):
- `pending_selection`: amber
- `pending_payment`: amber
- `paid`: yellow
- `assigned`: blue
- `collected`: purple
- `delivered`: green
- `cancelled`: gray

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/pickup-jobs/page.tsx
git commit -m "feat: add admin pickup jobs management page"
```

---

## Task 9: Admin Rate Bands — Add Transporter Tab

**Files:**
- Modify: `app/admin/rate-bands/page.tsx`

The existing page shows measurement rate bands only. Convert it to a tabbed page with two tabs: "Measurement" and "Transporter".

- [ ] **Step 1: Read the current file**

Read `app/admin/rate-bands/page.tsx` (162 lines). The existing page:
- Loads `measurement_rate_bands` (id, zone_name, base_fee, active)
- Has create form with zone_name + base_fee
- Has toggle active button

- [ ] **Step 2: Rewrite with tabs**

Add:
- `type Tab = 'measurement' | 'transporter'`
- `const [activeTab, setActiveTab] = useState<Tab>('measurement')`
- Tab switcher buttons at the top (after the admin guard loads)

For transporter tab, add:
```typescript
type TransporterBand = {
  id: string;
  zone_name: string;
  origin_city: string;
  origin_country: string;
  base_fee: number;
  per_cbm_fee: number;
  vehicle_type: string | null;
  active: boolean;
  created_at: string;
};
```
- State: `tBands`, `tZoneName`, `tOriginCity`, `tOriginCountry`, `tBaseFee`, `tPerCbmFee`, `tVehicleType`
- `loadTransporterBands()` queries `transporter_rate_bands`
- Create form: zone_name, origin_city, origin_country, base_fee, per_cbm_fee (optional, default 0), vehicle_type (optional text)
- Toggle active/inactive same as measurement tab

Keep the existing measurement tab logic unchanged. Load both tables on init. Switch display with `activeTab`.

Update page title to "Rate Bands" (remove "Measurement" qualifier from h1).

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/rate-bands/page.tsx
git commit -m "feat: add transporter rate bands tab to admin rate-bands page"
```

---

## Task 10: Transporter Dashboard + Admin Hub Tile

**Files:**
- Modify: `app/transporter/page.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Update transporter dashboard**

In `app/transporter/page.tsx`, the approved state (lines 152–199) has a "Coming Soon" card.

Replace the "Coming Soon" card with real counts, mirroring what Phase 2 did for the measurement agent dashboard:

Add state: `const [jobCounts, setJobCounts] = useState({ assigned: 0, collected: 0, delivered: 0 });`

After `setTransporterProfile(transporterData ?? null)` in useEffect, add:
```typescript
if (transporterData) {
  const { data: jobs } = await supabase
    .from('pickup_jobs')
    .select('status')
    .eq('transporter_profile_id', transporterData.id);
  const counts = { assigned: 0, collected: 0, delivered: 0 };
  for (const job of jobs ?? []) {
    if (job.status === 'assigned') counts.assigned++;
    else if (job.status === 'collected') counts.collected++;
    else if (job.status === 'delivered') counts.delivered++;
  }
  setJobCounts(counts);
}
```

Expand stats block to 4 stats: Jobs Completed, Active Jobs (`assigned + collected`), Average Rating, In Transit (`collected`).

Replace "Coming Soon" card with a `Link` card to `/transporter/jobs`:
```tsx
<Link
  href="/transporter/jobs"
  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between hover:border-orange-200 hover:bg-orange-50 transition-colors group"
>
  <div>
    <p className="font-bold text-gray-800 group-hover:text-orange-600 transition-colors">My Pickup Jobs</p>
    <p className="text-sm text-gray-500 mt-0.5">View assigned and in-transit pickup jobs</p>
  </div>
  <div className="flex items-center gap-3">
    {(jobCounts.assigned + jobCounts.collected) > 0 && (
      <span className="badge text-white font-bold text-xs px-3 py-2" style={{ backgroundColor: '#f97316' }}>
        {jobCounts.assigned + jobCounts.collected} active
      </span>
    )}
    <span className="text-gray-300 group-hover:text-orange-400 text-xl transition-colors">→</span>
  </div>
</Link>
```

- [ ] **Step 2: Add admin hub tile**

In `app/admin/page.tsx`, add to the Operations grid array after `/admin/rate-bands`:
```typescript
{ href: '/admin/pickup-jobs', label: 'Pickup Jobs', icon: '🚚', desc: 'Track pickup & delivery jobs' },
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/transporter/page.tsx app/admin/page.tsx
git commit -m "feat: add real job counts to transporter dashboard and pickup jobs tile to admin hub"
```

---

## Completion Checklist

After all tasks are done, verify:

- [ ] `transporter_rate_bands`, `pickup_jobs`, `pickup_job_payments` tables exist in Supabase with RLS
- [ ] All 3 Edge Functions deployed and callable
- [ ] Transporter can see assigned jobs at `/transporter/jobs`, confirm collection and delivery at `/transporter/jobs/[id]`
- [ ] Shipper can request pickup at `/pickup/[bookingId]`, select transporter, pay via Paystack
- [ ] Admin can view all pickup jobs at `/admin/pickup-jobs` and cancel them
- [ ] Admin can manage transporter rate bands at `/admin/rate-bands` (Transporter tab)
- [ ] Transporter dashboard shows real counts
- [ ] Admin hub has "Pickup Jobs" tile
- [ ] `npx tsc --noEmit` passes with zero errors on master after merge
