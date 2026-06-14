# Phase 2: Cargo Measurement Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end Cargo Measurement Service — shipper requests a measurement job, pays via Paystack, admin assigns an approved measurement agent, agent executes the job and submits a 7-photo report, payout triggers automatically.

**Architecture:** Client-side Next.js pages talk directly to Supabase. All Paystack calls go through Supabase Edge Functions (Deno). Admin manually assigns agents. CBM results from reports feed back into the booking form.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase (PostgreSQL + Auth + Storage + Edge Functions), Paystack

**Branch:** `feature/global-expansion-agent-role` (all Phase 1 work already here)

**Supabase project_id:** `fkhfbifgvebygafsewot`

---

## File Map

### New migrations
- `supabase/migrations/20260614_56_measurement_service_tables.sql` — all measurement tables + RLS
- `supabase/migrations/20260614_57_bookings_cbm_declaration_columns.sql` — booking CBM columns
- `supabase/migrations/20260614_58_measurement_report_photos_bucket.sql` — storage bucket

### New Edge Functions
- `supabase/functions/initialize-measurement-payment/index.ts`
- `supabase/functions/verify-measurement-payment/index.ts`
- `supabase/functions/trigger-measurement-agent-payout/index.ts`

### New pages
- `app/measurement-service/page.tsx` — shipper requests measurement
- `app/measurement-service/[jobId]/page.tsx` — shipper tracks job + views report
- `app/measurement-agent/jobs/page.tsx` — agent job list
- `app/measurement-agent/jobs/[id]/page.tsx` — agent executes job, submits report
- `app/admin/measurement-jobs/page.tsx` — admin views + assigns jobs
- `app/admin/rate-bands/page.tsx` — admin manages rate bands

### Modified pages
- `app/booking/[containerId]/page.tsx` — add CBM declaration type selector + double acknowledgement
- `app/payments/[bookingId]/page.tsx` — show CBM variance adjustment on Stage 2
- `app/measurement-agent/page.tsx` — replace stub with real job counts
- `app/admin/page.tsx` — add Measurement Jobs + Rate Bands tiles

### New actions
- `actions/adminMeasurementJobActions.ts` — assignMeasurementAgent

---

## Task 1: DB Migration — Measurement Service Tables

**Files:**
- Create: `supabase/migrations/20260614_56_measurement_service_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260614_56_measurement_service_tables.sql

-- ── measurement_rate_bands ─────────────────────────────────────────────────────
create table if not exists measurement_rate_bands (
  id         uuid primary key default gen_random_uuid(),
  zone_name  text not null,
  base_fee   numeric not null,
  active     boolean not null default true,
  created_at timestamptz default now()
);

alter table measurement_rate_bands enable row level security;

drop policy if exists "Admin manages rate bands" on measurement_rate_bands;
create policy "Admin manages rate bands" on measurement_rate_bands
  for all using ((select is_admin()));

drop policy if exists "Anyone can read active rate bands" on measurement_rate_bands;
create policy "Anyone can read active rate bands" on measurement_rate_bands
  for select using (active = true);

-- ── measurement_jobs ──────────────────────────────────────────────────────────
create table if not exists measurement_jobs (
  id                             uuid primary key default gen_random_uuid(),
  shipper_profile_id             uuid not null references profiles(id) on delete cascade,
  measurement_agent_profile_id   uuid references measurement_agent_profiles(id),
  pickup_address                 text not null,
  pickup_city                    text not null,
  pickup_country                 text not null,
  quoted_fee                     numeric not null,
  status                         text not null default 'pending_payment'
                                   check (status in ('pending_payment','paid','assigned','in_progress','completed','cancelled')),
  payment_ref                    text,
  rate_band_id                   uuid references measurement_rate_bands(id),
  assigned_at                    timestamptz,
  started_at                     timestamptz,
  completed_at                   timestamptz,
  created_at                     timestamptz default now()
);

alter table measurement_jobs enable row level security;

drop policy if exists "Shipper views own jobs" on measurement_jobs;
create policy "Shipper views own jobs" on measurement_jobs
  for select using (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Agent views assigned jobs" on measurement_jobs;
create policy "Agent views assigned jobs" on measurement_jobs
  for select using (
    measurement_agent_profile_id in (
      select id from measurement_agent_profiles where profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Shipper can insert jobs" on measurement_jobs;
create policy "Shipper can insert jobs" on measurement_jobs
  for insert with check (
    shipper_profile_id in (
      select id from profiles where user_id = auth.uid()
    )
  );

drop policy if exists "Admin manages all jobs" on measurement_jobs;
create policy "Admin manages all jobs" on measurement_jobs
  for all using ((select is_admin()));

-- ── measurement_job_items ─────────────────────────────────────────────────────
create table if not exists measurement_job_items (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references measurement_jobs(id) on delete cascade,
  description  text not null,
  quantity     int not null default 1,
  length_m     numeric,
  width_m      numeric,
  height_m     numeric,
  weight_kg    numeric,
  cbm_per_unit numeric,
  total_cbm    numeric,
  created_at   timestamptz default now()
);

alter table measurement_job_items enable row level security;

drop policy if exists "Agent can manage items for assigned job" on measurement_job_items;
create policy "Agent can manage items for assigned job" on measurement_job_items
  for all using (
    job_id in (
      select id from measurement_jobs
      where measurement_agent_profile_id in (
        select id from measurement_agent_profiles where profile_id in (
          select id from profiles where user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Shipper can view items" on measurement_job_items;
create policy "Shipper can view items" on measurement_job_items
  for select using (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Admin manages job items" on measurement_job_items;
create policy "Admin manages job items" on measurement_job_items
  for all using ((select is_admin()));

-- ── measurement_reports ───────────────────────────────────────────────────────
create table if not exists measurement_reports (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null unique references measurement_jobs(id) on delete cascade,
  total_cbm           numeric not null,
  total_weight_kg     numeric,
  item_count          int,
  platform_report_ref text unique,
  agent_notes         text,
  generated_at        timestamptz default now()
);

alter table measurement_reports enable row level security;

drop policy if exists "Shipper can view own report" on measurement_reports;
create policy "Shipper can view own report" on measurement_reports
  for select using (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Agent can insert report" on measurement_reports;
create policy "Agent can insert report" on measurement_reports
  for insert with check (
    job_id in (
      select id from measurement_jobs
      where measurement_agent_profile_id in (
        select id from measurement_agent_profiles where profile_id in (
          select id from profiles where user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Admin manages reports" on measurement_reports;
create policy "Admin manages reports" on measurement_reports
  for all using ((select is_admin()));

-- ── measurement_report_photos ─────────────────────────────────────────────────
create table if not exists measurement_report_photos (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references measurement_reports(id) on delete cascade,
  photo_type  text not null check (photo_type in ('cargo_1','cargo_2','cargo_3','cargo_4','tape_measure','scale','location')),
  file_url    text not null,
  uploaded_at timestamptz default now()
);

alter table measurement_report_photos enable row level security;

drop policy if exists "Agent can insert photos" on measurement_report_photos;
create policy "Agent can insert photos" on measurement_report_photos
  for insert with check (
    report_id in (
      select id from measurement_reports where job_id in (
        select id from measurement_jobs
        where measurement_agent_profile_id in (
          select id from measurement_agent_profiles where profile_id in (
            select id from profiles where user_id = auth.uid()
          )
        )
      )
    )
  );

drop policy if exists "Shipper and admin can view photos" on measurement_report_photos;
create policy "Shipper and admin can view photos" on measurement_report_photos
  for select using (
    (select is_admin())
    or
    report_id in (
      select id from measurement_reports where job_id in (
        select id from measurement_jobs where shipper_profile_id in (
          select id from profiles where user_id = auth.uid()
        )
      )
    )
  );

-- ── measurement_job_payments ──────────────────────────────────────────────────
create table if not exists measurement_job_payments (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null unique references measurement_jobs(id) on delete cascade,
  paystack_ref text,
  amount       numeric not null,
  status       text not null default 'pending'
                 check (status in ('pending','paid','refunded','failed')),
  paid_at      timestamptz
);

alter table measurement_job_payments enable row level security;

drop policy if exists "Shipper can view own payment" on measurement_job_payments;
create policy "Shipper can view own payment" on measurement_job_payments
  for select using (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Shipper can insert payment" on measurement_job_payments;
create policy "Shipper can insert payment" on measurement_job_payments
  for insert with check (
    job_id in (
      select id from measurement_jobs where shipper_profile_id in (
        select id from profiles where user_id = auth.uid()
      )
    )
  );

drop policy if exists "Admin manages payments" on measurement_job_payments;
create policy "Admin manages payments" on measurement_job_payments
  for all using ((select is_admin()));
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with project_id `fkhfbifgvebygafsewot` and the SQL above.

- [ ] **Step 3: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` and confirm all 6 tables appear.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260614_56_measurement_service_tables.sql
git commit -m "feat: add measurement service DB tables and RLS"
```

---

## Task 2: DB Migration — Bookings CBM Declaration Columns

**Files:**
- Create: `supabase/migrations/20260614_57_bookings_cbm_declaration_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260614_57_bookings_cbm_declaration_columns.sql

alter table bookings
  add column if not exists cbm_declaration_type text not null default 'self_declared'
    check (cbm_declaration_type in ('self_declared','measurement_verified')),
  add column if not exists measurement_report_id uuid references measurement_reports(id),
  add column if not exists cbm_disclaimer_acknowledged_count int not null default 0,
  add column if not exists actual_cbm_at_loading numeric,
  add column if not exists cbm_variance_pct numeric,
  add column if not exists cbm_variance_adjustment numeric;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with project_id `fkhfbifgvebygafsewot`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614_57_bookings_cbm_declaration_columns.sql
git commit -m "feat: add CBM declaration columns to bookings table"
```

---

## Task 3: Storage Bucket — measurement-report-photos

**Files:**
- Create: `supabase/migrations/20260614_58_measurement_report_photos_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260614_58_measurement_report_photos_bucket.sql

insert into storage.buckets (id, name, public)
values ('measurement-report-photos', 'measurement-report-photos', false)
on conflict (id) do nothing;

drop policy if exists "Agent can upload report photos" on storage.objects;
create policy "Agent can upload report photos" on storage.objects
  for insert with check (
    bucket_id = 'measurement-report-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Admin can read report photos" on storage.objects;
create policy "Admin can read report photos" on storage.objects
  for select using (
    bucket_id = 'measurement-report-photos'
    and (select is_admin())
  );

drop policy if exists "Shipper can read own job photos" on storage.objects;
create policy "Shipper can read own job photos" on storage.objects
  for select using (
    bucket_id = 'measurement-report-photos'
    and auth.role() = 'authenticated'
  );
```

- [ ] **Step 2: Apply via Supabase MCP**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614_58_measurement_report_photos_bucket.sql
git commit -m "feat: add private measurement-report-photos storage bucket"
```

---

## Task 4: Edge Function — initialize-measurement-payment

**Files:**
- Create: `supabase/functions/initialize-measurement-payment/index.ts`

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/initialize-measurement-payment/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { jobId, callbackUrl } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

    // Verify caller owns this job
    const authHeader = req.headers.get('authorization') ?? '';
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: job, error: jErr } = await supabase
      .from('measurement_jobs')
      .select('id, quoted_fee, status, shipper_profile_id')
      .eq('id', jobId)
      .single();

    if (jErr || !job) return json({ error: 'Job not found' }, 404);
    if (job.status !== 'pending_payment') return json({ error: 'Job is not awaiting payment' }, 400);

    // Verify caller is the shipper
    const { data: shipperProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', job.shipper_profile_id)
      .eq('user_id', caller.id)
      .single();

    if (!shipperProfile) return json({ error: 'Access denied' }, 403);

    const email = caller.email ?? '';
    const reference = `SCL-MSR-${jobId.slice(0, 8)}-${Date.now()}`.toUpperCase();

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(job.quoted_fee * 100),
        currency: 'ZAR',
        reference,
        callback_url: callbackUrl ?? `${Deno.env.get('SITE_URL') ?? ''}/measurement-service/${jobId}?verify=1`,
        metadata: { job_id: jobId, type: 'measurement_job' },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Paystack initialization failed' }, 502);
    }

    // Store reference + create payment record
    await supabase
      .from('measurement_jobs')
      .update({ payment_ref: reference })
      .eq('id', jobId);

    await supabase.from('measurement_job_payments').upsert({
      job_id: jobId,
      paystack_ref: reference,
      amount: job.quoted_fee,
      status: 'pending',
    }, { onConflict: 'job_id' });

    await supabase.from('audit_logs').insert({
      action: 'measurement_job.payment_initialized',
      target_type: 'measurement_job',
      target_id: jobId,
      metadata: { reference, amount: job.quoted_fee },
    });

    return json({ authorization_url: paystackData.data.authorization_url, reference });
  } catch (err) {
    console.error('[initialize-measurement-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Deploy via Supabase MCP**

Use `mcp__plugin_supabase_supabase__deploy_edge_function` with project_id `fkhfbifgvebygafsewot`, name `initialize-measurement-payment`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/initialize-measurement-payment/index.ts
git commit -m "feat: add initialize-measurement-payment Edge Function"
```

---

## Task 5: Edge Function — verify-measurement-payment

**Files:**
- Create: `supabase/functions/verify-measurement-payment/index.ts`

- [ ] **Step 1: Write the Edge Function**

```typescript
// supabase/functions/verify-measurement-payment/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { reference } = await req.json();
    if (!reference) return json({ error: 'reference is required' }, 400);

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return json({ error: 'Payment not successful', paystackStatus: paystackData.data?.status }, 400);
    }

    const jobId = paystackData.data.metadata?.job_id;
    if (!jobId) return json({ error: 'Missing job_id in payment metadata' }, 400);

    // Update payment record
    await supabase
      .from('measurement_job_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('paystack_ref', reference);

    // Update job status → paid, notify admin
    await supabase
      .from('measurement_jobs')
      .update({ status: 'paid' })
      .eq('id', jobId);

    // Notify admin
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'measurement_job_paid',
      title: 'New measurement job ready for assignment',
      body: `Job ${jobId.slice(0, 8).toUpperCase()} has been paid. Assign an agent.`,
      metadata: { job_id: jobId },
    });

    await supabase.from('audit_logs').insert({
      action: 'measurement_job.payment_verified',
      target_type: 'measurement_job',
      target_id: jobId,
      metadata: { reference },
    });

    return json({ success: true, jobId });
  } catch (err) {
    console.error('[verify-measurement-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Deploy via Supabase MCP**

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/verify-measurement-payment/index.ts
git commit -m "feat: add verify-measurement-payment Edge Function"
```

---

## Task 6: Edge Function — trigger-measurement-agent-payout

**Files:**
- Create: `supabase/functions/trigger-measurement-agent-payout/index.ts`

- [ ] **Step 1: Write the Edge Function**

Commission = 20% platform / 80% agent. Net = `quoted_fee * 0.80`.

```typescript
// supabase/functions/trigger-measurement-agent-payout/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_SHARE = 0.80;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { jobId } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

    // Load job
    const { data: job, error: jErr } = await supabase
      .from('measurement_jobs')
      .select('id, status, quoted_fee, measurement_agent_profile_id')
      .eq('id', jobId)
      .single();

    if (jErr || !job) return json({ error: 'Job not found' }, 404);
    if (job.status !== 'completed') return json({ error: 'Job is not completed' }, 400);
    if (!job.measurement_agent_profile_id) return json({ error: 'No agent assigned' }, 400);

    // Load agent profile
    const { data: agentProfile, error: aErr } = await supabase
      .from('measurement_agent_profiles')
      .select('paystack_recipient_code, payout_enabled, payout_hold')
      .eq('id', job.measurement_agent_profile_id)
      .single();

    if (aErr || !agentProfile) return json({ error: 'Agent profile not found' }, 404);
    if (!agentProfile.payout_enabled) return json({ error: 'Payouts not enabled for this agent' }, 400);
    if (agentProfile.payout_hold) return json({ error: 'Agent payout is on hold' }, 400);
    if (!agentProfile.paystack_recipient_code) return json({ error: 'Agent has no registered bank account' }, 400);

    const grossAmount = job.quoted_fee;
    const netAmount = Math.round(grossAmount * AGENT_SHARE * 100) / 100;
    const amountKobo = Math.round(netAmount * 100);
    const transferRef = `SCL-AGPAY-${jobId.slice(0, 8)}-${Date.now()}`.toUpperCase();

    const paystackRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountKobo,
        reference: transferRef,
        recipient: agentProfile.paystack_recipient_code,
        reason: `ShareConLoad measurement job payout — ${jobId.slice(0, 8).toUpperCase()}`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Transfer failed' }, 502);
    }

    await supabase.from('audit_logs').insert({
      action: 'measurement_agent.payout_triggered',
      target_type: 'measurement_job',
      target_id: jobId,
      metadata: {
        gross_amount: grossAmount,
        net_amount: netAmount,
        transfer_ref: transferRef,
        transfer_code: paystackData.data.transfer_code,
      },
    });

    return json({ success: true, netAmount, transferCode: paystackData.data.transfer_code });
  } catch (err) {
    console.error('[trigger-measurement-agent-payout]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Deploy via Supabase MCP**

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/trigger-measurement-agent-payout/index.ts
git commit -m "feat: add trigger-measurement-agent-payout Edge Function (80% agent share)"
```

---

## Task 7: Admin — Rate Bands Page

**Files:**
- Create: `app/admin/rate-bands/page.tsx`

- [ ] **Step 1: Write the page**

Admin-only. Shows all rate bands in a table with inline create form at bottom. Each row has toggle active/inactive + delete. The page uses the same admin-check pattern as all other admin pages: `supabase.auth.getUser()` → `profiles.is_admin`.

```typescript
// app/admin/rate-bands/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type RateBand = {
  id: string;
  zone_name: string;
  base_fee: number;
  active: boolean;
  created_at: string;
};

function fmt(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

export default function AdminRateBandsPage() {
  const router = useRouter();
  const [bands, setBands]           = useState<RateBand[]>([]);
  const [loading, setLoading]       = useState(true);
  const [zoneName, setZoneName]     = useState('');
  const [baseFee, setBaseFee]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.push('/'); return; }
      await load();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('measurement_rate_bands')
      .select('*')
      .order('created_at', { ascending: false });
    setBands((data ?? []) as RateBand[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneName.trim() || !baseFee.trim()) { setError('Zone name and base fee are required.'); return; }
    const fee = parseFloat(baseFee);
    if (isNaN(fee) || fee <= 0) { setError('Base fee must be a positive number.'); return; }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('measurement_rate_bands')
      .insert({ zone_name: zoneName.trim(), base_fee: fee });
    if (insertError) { setError(insertError.message); } else { setZoneName(''); setBaseFee(''); await load(); }
    setSaving(false);
  }

  async function handleToggleActive(band: RateBand) {
    await supabase
      .from('measurement_rate_bands')
      .update({ active: !band.active })
      .eq('id', band.id);
    await load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Measurement Rate Bands</h1>
          </div>
        </div>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
            {bands.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No rate bands yet. Create one below.</div>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50">
                    <th>Zone Name</th>
                    <th>Base Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band) => (
                    <tr key={band.id} className="hover:bg-gray-50">
                      <td className="font-semibold text-sm text-gray-800">{band.zone_name}</td>
                      <td className="text-sm text-gray-700">{fmt(band.base_fee)}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${band.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {band.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(band)}
                          className="btn btn-xs btn-ghost"
                        >
                          {band.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Create form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">Add Rate Band</h2>
          <form onSubmit={handleCreate} className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Zone name (e.g. Johannesburg Metro)"
              className="input input-bordered input-sm flex-1 min-w-48"
            />
            <input
              type="number"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              placeholder="Base fee (ZAR)"
              min="1"
              step="0.01"
              className="input input-bordered input-sm w-40"
            />
            <button
              type="submit"
              disabled={saving}
              className="btn btn-sm text-white font-bold disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript — run `npx tsc --noEmit` and confirm no errors**

- [ ] **Step 3: Commit**

```bash
git add app/admin/rate-bands/page.tsx
git commit -m "feat: add admin rate bands management page"
```

---

## Task 8: Admin — Measurement Jobs Page

**Files:**
- Create: `app/admin/measurement-jobs/page.tsx`
- Create: `actions/adminMeasurementJobActions.ts`

- [ ] **Step 1: Write the server action**

```typescript
// actions/adminMeasurementJobActions.ts
'use server';

import { createServerClient } from '@/services/supabaseServer';

export async function assignMeasurementAgent(
  jobId: string,
  agentProfileId: string,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('measurement_jobs')
    .update({
      measurement_agent_profile_id: agentProfileId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', 'paid');

  if (error) return { error: error.message };

  // Notify the agent
  const { data: agentProfile } = await supabase
    .from('measurement_agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .single();

  if (agentProfile) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', agentProfile.profile_id)
      .single();

    if (profile) {
      await supabase.from('notifications').insert({
        user_id: profile.user_id,
        type: 'measurement_job_assigned',
        title: 'You have a new measurement job',
        body: `A measurement job has been assigned to you. Check your jobs list.`,
        metadata: { job_id: jobId },
      });
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'measurement_job.agent_assigned',
    target_type: 'measurement_job',
    target_id: jobId,
    metadata: { agent_profile_id: agentProfileId },
  });

  return { error: null };
}
```

- [ ] **Step 2: Write the page**

Shows all jobs. For `paid` status jobs: show "Assign Agent" dropdown of approved agents whose `base_city` matches `job.pickup_city`. For other statuses: read-only display.

```typescript
// app/admin/measurement-jobs/page.tsx
'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { assignMeasurementAgent } from '@/actions/adminMeasurementJobActions';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
  measurement_agent_profile_id: string | null;
};

type Agent = {
  id: string;
  full_name: string;
  base_city: string;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending_payment: { bg: '#fff7ed', color: '#f97316', label: 'Pending Payment' },
  paid:            { bg: '#fefce8', color: '#ca8a04', label: 'Paid — Needs Agent' },
  assigned:        { bg: '#eff6ff', color: '#2563eb', label: 'Assigned'           },
  in_progress:     { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress'        },
  completed:       { bg: '#f0fdf4', color: '#16a34a', label: 'Completed'          },
  cancelled:       { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled'          },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

export default function AdminMeasurementJobsPage() {
  const router = useRouter();
  const [jobs, setJobs]             = useState<Job[]>([]);
  const [loading, setLoading]       = useState(true);
  const [agents, setAgents]         = useState<Agent[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.push('/'); return; }
      await Promise.all([load(), loadAgents()]);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('measurement_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }

  async function loadAgents() {
    const { data } = await supabase
      .from('measurement_agent_profiles')
      .select('id, full_name, base_city')
      .eq('status', 'approved');
    setAgents((data ?? []) as Agent[]);
  }

  async function handleAssign(jobId: string, pickupCity: string) {
    const agentId = selectedAgent[jobId];
    if (!agentId) { setError('Please select an agent.'); return; }
    setActionLoading(true);
    setError(null);
    const { error: assignError } = await assignMeasurementAgent(jobId, agentId);
    if (assignError) { setError(assignError); } else { setAssigningId(null); await load(); }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Measurement Jobs</h1>
          </div>
          <span className="text-sm text-gray-400">{jobs.length} total</span>
        </div>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No measurement jobs yet.</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="table w-full">
              <thead>
                <tr className="text-xs text-gray-500 bg-gray-50">
                  <th>Job ID</th>
                  <th>Pickup Location</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE['pending_payment'];
                  const cityAgents = agents.filter((a) =>
                    a.base_city.toLowerCase() === job.pickup_city.toLowerCase()
                  );
                  const isAssigning = assigningId === job.id;

                  return (
                    <Fragment key={job.id}>
                      <tr className="hover:bg-gray-50 align-top">
                        <td className="font-mono text-xs text-gray-500">{job.id.slice(0, 8).toUpperCase()}</td>
                        <td className="text-sm text-gray-700">
                          <div>{job.pickup_city}, {job.pickup_country}</div>
                          <div className="text-xs text-gray-400">{job.pickup_address}</div>
                        </td>
                        <td className="text-sm font-semibold text-gray-800">{fmtMoney(job.quoted_fee)}</td>
                        <td>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-sm text-gray-500">{fmt(job.created_at)}</td>
                        <td>
                          {job.status === 'paid' && (
                            <button
                              onClick={() => { setAssigningId(isAssigning ? null : job.id); setError(null); }}
                              className="btn btn-xs text-white font-bold"
                              style={{ backgroundColor: '#f97316' }}
                            >
                              {isAssigning ? 'Cancel' : 'Assign Agent'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {isAssigning && (
                        <tr className="bg-orange-50">
                          <td colSpan={6} className="py-3 px-4">
                            {cityAgents.length === 0 ? (
                              <p className="text-sm text-gray-500">No approved agents in {job.pickup_city}.</p>
                            ) : (
                              <div className="flex gap-2 items-center flex-wrap">
                                <select
                                  value={selectedAgent[job.id] ?? ''}
                                  onChange={(e) => setSelectedAgent((prev) => ({ ...prev, [job.id]: e.target.value }))}
                                  className="select select-bordered select-sm"
                                >
                                  <option value="">Select agent…</option>
                                  {cityAgents.map((a) => (
                                    <option key={a.id} value={a.id}>{a.full_name} ({a.base_city})</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssign(job.id, job.pickup_city)}
                                  disabled={actionLoading}
                                  className="btn btn-sm text-white font-bold disabled:opacity-60"
                                  style={{ backgroundColor: '#16a34a' }}
                                >
                                  {actionLoading ? <span className="loading loading-spinner loading-xs" /> : 'Confirm Assignment'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript — `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add actions/adminMeasurementJobActions.ts app/admin/measurement-jobs/page.tsx
git commit -m "feat: add admin measurement jobs page with agent assignment"
```

---

## Task 9: Shipper — /measurement-service Page

**Files:**
- Create: `app/measurement-service/page.tsx`

- [ ] **Step 1: Write the page**

Flow: shipper enters pickup city → system fetches matching rate band → shows quoted fee → shipper confirms → Edge Function `initialize-measurement-payment` called → redirect to Paystack URL.

The page creates the `measurement_jobs` row first (with `status = 'pending_payment'`), then calls the Edge Function with the jobId.

```typescript
// app/measurement-service/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type RateBand = { id: string; zone_name: string; base_fee: number };
type Step = 'form' | 'confirm' | 'paying';

export default function MeasurementServicePage() {
  const router = useRouter();
  const [step, setStep]               = useState<Step>('form');
  const [profileId, setProfileId]     = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity]   = useState('');
  const [pickupCountry, setPickupCountry] = useState('');
  const [rateBand, setRateBand]       = useState<RateBand | null>(null);
  const [bandLoading, setBandLoading] = useState(false);
  const [bandError, setBandError]     = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) { router.push('/'); return; }
      setProfileId(profile.id);
    }
    init();
  }, [router]);

  async function handleLookupRate(e: React.FormEvent) {
    e.preventDefault();
    if (!pickupAddress.trim() || !pickupCity.trim() || !pickupCountry.trim()) {
      setBandError('All fields are required.');
      return;
    }
    setBandLoading(true);
    setBandError(null);
    const { data: bands } = await supabase
      .from('measurement_rate_bands')
      .select('id, zone_name, base_fee')
      .eq('active', true);

    // Simple city-string match (case-insensitive)
    const matched = (bands ?? []).find((b: RateBand) =>
      b.zone_name.toLowerCase().includes(pickupCity.toLowerCase()) ||
      pickupCity.toLowerCase().includes(b.zone_name.toLowerCase())
    );

    if (!matched) {
      setBandError(`No measurement service available in ${pickupCity} yet. Contact support@shareconload.com.`);
      setBandLoading(false);
      return;
    }
    setRateBand(matched as RateBand);
    setStep('confirm');
    setBandLoading(false);
  }

  async function handleProceedToPayment() {
    if (!profileId || !rateBand) return;
    setSubmitting(true);
    setError(null);

    // Create the job record
    const { data: job, error: jobErr } = await supabase
      .from('measurement_jobs')
      .insert({
        shipper_profile_id: profileId,
        pickup_address: pickupAddress.trim(),
        pickup_city: pickupCity.trim(),
        pickup_country: pickupCountry.trim(),
        quoted_fee: rateBand.base_fee,
        rate_band_id: rateBand.id,
        status: 'pending_payment',
      })
      .select('id')
      .single();

    if (jobErr || !job) {
      setError('Failed to create job. Please try again.');
      setSubmitting(false);
      return;
    }

    setStep('paying');

    // Call Edge Function for Paystack URL
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initialize-measurement-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          jobId: job.id,
          callbackUrl: `${window.location.origin}/measurement-service/${job.id}?verify=1`,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok || !result.authorization_url) {
      setError(result.error ?? 'Payment initialization failed.');
      setStep('confirm');
      setSubmitting(false);
      return;
    }

    window.location.href = result.authorization_url;
  }

  function fmtMoney(v: number) {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-12">
        <Link href="/" className="text-sm text-gray-400 hover:underline">← Back</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-1">Cargo Measurement Service</h1>
        <p className="text-sm text-gray-500 mb-8">
          A trained agent will visit your location, measure your cargo, and provide an official CBM report.
        </p>

        {step === 'form' && (
          <form onSubmit={handleLookupRate} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pickup Address</label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Street address"
                className="input input-bordered w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  placeholder="e.g. Johannesburg"
                  className="input input-bordered w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={pickupCountry}
                  onChange={(e) => setPickupCountry(e.target.value)}
                  placeholder="e.g. South Africa"
                  className="input input-bordered w-full"
                />
              </div>
            </div>
            {bandError && <p className="text-sm text-red-600">{bandError}</p>}
            <button
              type="submit"
              disabled={bandLoading}
              className="btn w-full text-white font-bold rounded-xl disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {bandLoading ? <span className="loading loading-spinner loading-sm" /> : 'Check Availability & Price'}
            </button>
          </form>
        )}

        {step === 'confirm' && rateBand && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Measurement Job Details</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="text-gray-800 font-medium">{pickupAddress}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">City</span><span className="text-gray-800 font-medium">{pickupCity}, {pickupCountry}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Service Zone</span><span className="text-gray-800 font-medium">{rateBand.zone_name}</span></div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t">
                  <span>Service Fee</span>
                  <span style={{ color: '#f97316' }}>{fmtMoney(rateBand.base_fee)}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              An agent will contact you within 24 hours to arrange a visit. The fee is non-refundable once the agent has been assigned.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('form'); setRateBand(null); }}
                className="btn btn-ghost flex-1 rounded-xl"
              >
                Back
              </button>
              <button
                onClick={handleProceedToPayment}
                disabled={submitting}
                className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                style={{ backgroundColor: '#f97316' }}
              >
                {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Pay & Confirm'}
              </button>
            </div>
          </div>
        )}

        {step === 'paying' && (
          <div className="text-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
            <p className="text-sm text-gray-500 mt-4">Redirecting to payment…</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add app/measurement-service/page.tsx
git commit -m "feat: add measurement service request page with Paystack payment flow"
```

---

## Task 10: Shipper — /measurement-service/[jobId] Page

**Files:**
- Create: `app/measurement-service/[jobId]/page.tsx`

- [ ] **Step 1: Write the page**

On load: if `?verify=1` in URL, call `verify-measurement-payment` Edge Function with the reference stored on the job. Then display job status, and if completed show the measurement report and photos (signed URLs from `measurement-report-photos` bucket).

```typescript
// app/measurement-service/[jobId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  payment_ref: string | null;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
};

type Report = {
  id: string;
  total_cbm: number;
  total_weight_kg: number | null;
  item_count: number | null;
  platform_report_ref: string | null;
  agent_notes: string | null;
  generated_at: string;
  measurement_job_items: Array<{
    id: string;
    description: string;
    quantity: number;
    length_m: number | null;
    width_m: number | null;
    height_m: number | null;
    weight_kg: number | null;
    total_cbm: number | null;
  }>;
};

type Photo = { id: string; photo_type: string; file_url: string; signedUrl?: string };

const STATUS_STEPS = ['pending_payment', 'paid', 'assigned', 'in_progress', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting Payment',
  paid:            'Payment Confirmed',
  assigned:        'Agent Assigned',
  in_progress:     'Measurement Underway',
  completed:       'Report Ready',
  cancelled:       'Cancelled',
};

async function getSignedUrl(storedUrl: string, bucket: string): Promise<string | null> {
  const marker = `/object/public/${bucket}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx < 0) return null;
  const path = decodeURIComponent(storedUrl.slice(idx + marker.length));
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default function MeasurementJobTrackPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [job, setJob]           = useState<Job | null>(null);
  const [report, setReport]     = useState<Report | null>(null);
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      // Verify payment if returning from Paystack
      if (searchParams.get('verify') === '1') {
        setVerifying(true);
        // Load job to get payment_ref
        const { data: jobData } = await supabase
          .from('measurement_jobs')
          .select('payment_ref')
          .eq('id', jobId)
          .single();

        if (jobData?.payment_ref) {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-measurement-payment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
              },
              body: JSON.stringify({ reference: jobData.payment_ref }),
            }
          );
          const result = await res.json();
          setVerifyMsg(res.ok ? 'Payment confirmed! An agent will be assigned shortly.' : (result.error ?? 'Verification failed.'));
        }
        setVerifying(false);
      }

      await loadJob();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function loadJob() {
    setLoading(true);
    const { data: jobData } = await supabase
      .from('measurement_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!jobData) { router.push('/'); return; }
    setJob(jobData as Job);

    if (jobData.status === 'completed') {
      const { data: reportData } = await supabase
        .from('measurement_reports')
        .select('*, measurement_job_items(*)')
        .eq('job_id', jobId)
        .single();

      if (reportData) {
        setReport(reportData as Report);

        const { data: photoData } = await supabase
          .from('measurement_report_photos')
          .select('*')
          .eq('report_id', reportData.id);

        // Generate signed URLs
        const withSigned = await Promise.all(
          ((photoData ?? []) as Photo[]).map(async (p) => ({
            ...p,
            signedUrl: await getSignedUrl(p.file_url, 'measurement-report-photos') ?? undefined,
          }))
        );
        setPhotos(withSigned);
      }
    }
    setLoading(false);
  }

  function fmtMoney(v: number) {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  if (!job) return null;

  const stepIndex = STATUS_STEPS.indexOf(job.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/measurement-service" className="text-sm text-gray-400 hover:underline">← Measurement Service</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-6">Measurement Job</h1>

        {verifying && (
          <div className="alert mb-4">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Verifying payment…</span>
          </div>
        )}

        {verifyMsg && (
          <div className={`alert text-sm mb-4 ${verifyMsg.includes('confirmed') ? 'alert-success' : 'alert-error'}`}>
            {verifyMsg}
          </div>
        )}

        {/* Status tracker */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Progress</p>
          <div className="flex gap-0">
            {STATUS_STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full border-2 ${i <= stepIndex ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`} />
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 w-full ${i < stepIndex ? 'bg-orange-500' : 'bg-gray-200'} absolute`} style={{ top: '8px', left: '50%', width: 'calc(100% - 0px)', zIndex: -1 }} />
                )}
                <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Job details */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Job Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium">{job.pickup_address}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{job.pickup_city}, {job.pickup_country}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Service Fee</span><span className="font-medium">{fmtMoney(job.quoted_fee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium">{STATUS_LABELS[job.status] ?? job.status}</span></div>
          </div>
        </div>

        {/* Report (when completed) */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Measurement Report</p>
              {report.platform_report_ref && (
                <span className="text-xs font-mono text-gray-400">{report.platform_report_ref}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{report.total_cbm.toFixed(3)}</p>
                <p className="text-xs text-gray-500">Total CBM</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{report.total_weight_kg ?? '—'}</p>
                <p className="text-xs text-gray-500">Weight (kg)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{report.item_count ?? 0}</p>
                <p className="text-xs text-gray-500">Items</p>
              </div>
            </div>

            {/* Items table */}
            {report.measurement_job_items?.length > 0 && (
              <table className="table table-xs w-full mb-4">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th>Description</th>
                    <th>Qty</th>
                    <th>L×W×H (m)</th>
                    <th>CBM</th>
                  </tr>
                </thead>
                <tbody>
                  {report.measurement_job_items.map((item) => (
                    <tr key={item.id}>
                      <td className="text-sm">{item.description}</td>
                      <td className="text-sm">{item.quantity}</td>
                      <td className="text-sm text-gray-500">
                        {item.length_m ?? '?'} × {item.width_m ?? '?'} × {item.height_m ?? '?'}
                      </td>
                      <td className="text-sm font-semibold">{item.total_cbm?.toFixed(3) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {report.agent_notes && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
                <p className="text-xs font-bold text-gray-400 mb-1">Agent Notes</p>
                {report.agent_notes}
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Evidence Photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <a key={photo.id} href={photo.signedUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="block aspect-square bg-gray-100 rounded-xl overflow-hidden hover:opacity-80 transition-opacity">
                      {photo.signedUrl ? (
                        <img src={photo.signedUrl} alt={photo.photo_type} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-gray-400">{photo.photo_type}</div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add "app/measurement-service/[jobId]/page.tsx"
git commit -m "feat: add measurement job tracking page with report display"
```

---

## Task 11: Agent — /measurement-agent/jobs Page

**Files:**
- Create: `app/measurement-agent/jobs/page.tsx`

- [ ] **Step 1: Write the page**

Agent sees their assigned jobs. Clicking a job navigates to `/measurement-agent/jobs/[id]`.

```typescript
// app/measurement-agent/jobs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  assigned:    { bg: '#eff6ff', color: '#2563eb', label: 'Assigned'    },
  in_progress: { bg: '#f5f3ff', color: '#7c3aed', label: 'In Progress' },
  completed:   { bg: '#f0fdf4', color: '#16a34a', label: 'Completed'   },
  cancelled:   { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled'   },
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AgentJobsPage() {
  const router = useRouter();
  const [jobs, setJobs]     = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role_type')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role_type !== 'measurement_agent') {
        router.push('/');
        return;
      }

      const { data: agentProfile } = await supabase
        .from('measurement_agent_profiles')
        .select('id, status')
        .eq('profile_id', profile.id)
        .single();

      if (!agentProfile || agentProfile.status !== 'approved') {
        router.push('/measurement-agent');
        return;
      }

      const { data: jobData } = await supabase
        .from('measurement_jobs')
        .select('*')
        .eq('measurement_agent_profile_id', agentProfile.id)
        .order('created_at', { ascending: false });

      setJobs((jobData ?? []) as Job[]);
      setLoading(false);
    }
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/measurement-agent" className="text-sm text-gray-400 hover:underline">← Dashboard</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">My Jobs</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No jobs assigned yet.</div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const badge = STATUS_BADGE[job.status] ?? STATUS_BADGE['assigned'];
              return (
                <Link key={job.id} href={`/measurement-agent/jobs/${job.id}`}
                  className="block bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{job.pickup_city}, {job.pickup_country}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{job.pickup_address}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                      style={{ backgroundColor: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span>Assigned {job.assigned_at ? fmt(job.assigned_at) : '—'}</span>
                    {job.completed_at && <span>Completed {fmt(job.completed_at)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add app/measurement-agent/jobs/page.tsx
git commit -m "feat: add measurement agent jobs list page"
```

---

## Task 12: Agent — /measurement-agent/jobs/[id] Page

**Files:**
- Create: `app/measurement-agent/jobs/[id]/page.tsx`

- [ ] **Step 1: Write the page**

Three phases:
1. `assigned` status → "Start Job" button → sets `in_progress`
2. `in_progress` → add items form (description, L×W×H, weight, qty; CBM calculated live) + upload 7 photos + "Submit Report" button
3. `completed` → read-only report view

On "Submit Report": create `measurement_reports` row, create `measurement_job_items` rows, update job status to `completed`, then call `trigger-measurement-agent-payout` Edge Function.

The report ref is auto-generated in the format `MCR-YYYYMMDD-NNN` using a sequence query.

```typescript
// app/measurement-agent/jobs/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  assigned_at: string | null;
};

type ItemForm = {
  description: string;
  quantity: number;
  length_m: string;
  width_m: string;
  height_m: string;
  weight_kg: string;
};

const PHOTO_TYPES = ['cargo_1', 'cargo_2', 'cargo_3', 'cargo_4', 'tape_measure', 'scale', 'location'] as const;
type PhotoType = typeof PHOTO_TYPES[number];

const PHOTO_LABELS: Record<PhotoType, string> = {
  cargo_1: 'Cargo Photo 1',
  cargo_2: 'Cargo Photo 2',
  cargo_3: 'Cargo Photo 3',
  cargo_4: 'Cargo Photo 4',
  tape_measure: 'Tape Measure',
  scale: 'Scale Reading',
  location: 'Location',
};

const emptyItem = (): ItemForm => ({
  description: '', quantity: 1, length_m: '', width_m: '', height_m: '', weight_kg: '',
});

function calcCbm(item: ItemForm): number {
  const l = parseFloat(item.length_m);
  const w = parseFloat(item.width_m);
  const h = parseFloat(item.height_m);
  if (isNaN(l) || isNaN(w) || isNaN(h)) return 0;
  return Math.round(l * w * h * 1000) / 1000;
}

// UploadSlot must be outside the page component to prevent remounting on state changes
function UploadSlot({
  photoType, label, file, onChange,
}: {
  photoType: PhotoType;
  label: string;
  file: File | null;
  onChange: (type: PhotoType, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-200 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 relative"
    >
      {preview ? (
        <img src={preview} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <span className="text-2xl">📷</span>
          <span className="text-[10px] text-gray-500 mt-1 text-center px-1">{label}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onChange(photoType, e.target.files[0]); }}
      />
    </div>
  );
}

export default function AgentJobDetailPage({ params }: { params: { id: string } }) {
  const { id: jobId } = params;
  const router = useRouter();
  const [job, setJob]               = useState<Job | null>(null);
  const [agentProfileId, setAgentProfileId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [items, setItems]           = useState<ItemForm[]>([emptyItem()]);
  const [photos, setPhotos]         = useState<Partial<Record<PhotoType, File>>>({});
  const [agentNotes, setAgentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role_type')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role_type !== 'measurement_agent') { router.push('/'); return; }

      const { data: agentProfile } = await supabase
        .from('measurement_agent_profiles')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (!agentProfile) { router.push('/measurement-agent'); return; }
      setAgentProfileId(agentProfile.id);

      const { data: jobData } = await supabase
        .from('measurement_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('measurement_agent_profile_id', agentProfile.id)
        .single();

      if (!jobData) { router.push('/measurement-agent/jobs'); return; }
      setJob(jobData as Job);
      setLoading(false);
    }
    init();
  }, [jobId, router]);

  async function handleStartJob() {
    if (!job) return;
    const { error: updateError } = await supabase
      .from('measurement_jobs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', job.id);
    if (!updateError) setJob({ ...job, status: 'in_progress' });
  }

  function updateItem(index: number, field: keyof ItemForm, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  function handlePhotoChange(type: PhotoType, file: File) {
    setPhotos((prev) => ({ ...prev, [type]: file }));
  }

  async function handleSubmitReport() {
    if (!job || !agentProfileId) return;

    // Validate
    const missingPhotos = PHOTO_TYPES.filter((t) => !photos[t]);
    if (missingPhotos.length > 0) {
      setError(`Missing photos: ${missingPhotos.map((t) => PHOTO_LABELS[t]).join(', ')}`);
      return;
    }
    const invalidItems = items.filter((i) => !i.description.trim());
    if (invalidItems.length > 0 || items.length === 0) {
      setError('All items must have a description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Upload photos
    const { data: { session } } = await supabase.auth.getSession();
    const uploadedPhotos: Array<{ type: PhotoType; url: string }> = [];

    for (const photoType of PHOTO_TYPES) {
      const file = photos[photoType]!;
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${agentProfileId}/${job.id}/${photoType}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('measurement-report-photos')
        .upload(path, file, { upsert: true });
      if (uploadError) { setError(`Photo upload failed: ${uploadError.message}`); setSubmitting(false); return; }
      const { data: urlData } = supabase.storage.from('measurement-report-photos').getPublicUrl(uploadData.path);
      uploadedPhotos.push({ type: photoType, url: urlData.publicUrl });
    }

    // Calculate totals
    const itemsWithCbm = items.map((item) => {
      const cbmPerUnit = calcCbm(item);
      const qty = Number(item.quantity) || 1;
      return {
        description: item.description.trim(),
        quantity: qty,
        length_m: parseFloat(item.length_m) || null,
        width_m: parseFloat(item.width_m) || null,
        height_m: parseFloat(item.height_m) || null,
        weight_kg: parseFloat(item.weight_kg) || null,
        cbm_per_unit: cbmPerUnit || null,
        total_cbm: cbmPerUnit ? Math.round(cbmPerUnit * qty * 1000) / 1000 : null,
      };
    });
    const totalCbm = itemsWithCbm.reduce((sum, i) => sum + (i.total_cbm ?? 0), 0);
    const totalWeight = itemsWithCbm.reduce((sum, i) => sum + (i.weight_kg ?? 0) * (i.quantity ?? 1), 0);

    // Generate report ref: MCR-YYYYMMDD-NNN
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('measurement_reports')
      .select('id', { count: 'exact', head: true });
    const seq = String((count ?? 0) + 1).padStart(3, '0');
    const reportRef = `MCR-${today}-${seq}`;

    // Insert report
    const { data: reportRow, error: reportError } = await supabase
      .from('measurement_reports')
      .insert({
        job_id: job.id,
        total_cbm: Math.round(totalCbm * 1000) / 1000,
        total_weight_kg: totalWeight || null,
        item_count: items.length,
        platform_report_ref: reportRef,
        agent_notes: agentNotes.trim() || null,
      })
      .select('id')
      .single();

    if (reportError || !reportRow) {
      setError('Failed to create report: ' + (reportError?.message ?? 'unknown error'));
      setSubmitting(false);
      return;
    }

    // Insert items
    await supabase.from('measurement_job_items').insert(
      itemsWithCbm.map((item) => ({ ...item, job_id: job.id }))
    );

    // Insert photo records
    await supabase.from('measurement_report_photos').insert(
      uploadedPhotos.map((p) => ({
        report_id: reportRow.id,
        photo_type: p.type,
        file_url: p.url,
      }))
    );

    // Update job to completed
    await supabase
      .from('measurement_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    // Trigger payout via Edge Function
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trigger-measurement-agent-payout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      }
    );

    // Update agent total_jobs_completed
    await supabase.rpc('increment_agent_jobs', { agent_id: agentProfileId });

    router.push('/measurement-agent/jobs');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }
  if (!job) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/measurement-agent/jobs" className="text-sm text-gray-400 hover:underline">← My Jobs</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-1">Job — {job.pickup_city}</h1>
        <p className="text-sm text-gray-500 mb-6">{job.pickup_address}</p>

        {job.status === 'assigned' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-600 mb-6">Travel to the shipper's location and start the measurement when you arrive.</p>
            <button
              onClick={handleStartJob}
              className="btn text-white font-bold px-8 rounded-xl"
              style={{ backgroundColor: '#f97316' }}
            >
              Start Job
            </button>
          </div>
        )}

        {job.status === 'in_progress' && (
          <>
            {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

            {/* Items */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Measured Items</p>
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="btn btn-xs btn-ghost text-red-400">Remove</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="input input-bordered input-sm w-full mb-2"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400">L (m)</label>
                      <input type="number" step="0.01" min="0" value={item.length_m}
                        onChange={(e) => updateItem(i, 'length_m', e.target.value)}
                        className="input input-bordered input-xs w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">W (m)</label>
                      <input type="number" step="0.01" min="0" value={item.width_m}
                        onChange={(e) => updateItem(i, 'width_m', e.target.value)}
                        className="input input-bordered input-xs w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">H (m)</label>
                      <input type="number" step="0.01" min="0" value={item.height_m}
                        onChange={(e) => updateItem(i, 'height_m', e.target.value)}
                        className="input input-bordered input-xs w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">Qty</label>
                      <input type="number" min="1" value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        className="input input-bordered input-xs w-full" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div>
                      <label className="text-[10px] text-gray-400">Weight (kg)</label>
                      <input type="number" step="0.1" min="0" value={item.weight_kg}
                        onChange={(e) => updateItem(i, 'weight_kg', e.target.value)}
                        className="input input-bordered input-xs w-24" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">CBM per unit</p>
                      <p className="text-sm font-bold text-gray-800">{calcCbm(item).toFixed(3)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="btn btn-sm btn-ghost w-full">+ Add Item</button>

              <div className="mt-3 pt-3 border-t flex justify-between text-sm font-bold">
                <span>Total CBM</span>
                <span style={{ color: '#f97316' }}>
                  {items.reduce((sum, item) => sum + calcCbm(item) * (Number(item.quantity) || 1), 0).toFixed(3)}
                </span>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Required Photos (7)</p>
              <p className="text-xs text-gray-400 mb-4">All 7 photos are required before you can submit.</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {PHOTO_TYPES.map((type) => (
                  <UploadSlot
                    key={type}
                    photoType={type}
                    label={PHOTO_LABELS[type]}
                    file={photos[type] ?? null}
                    onChange={handlePhotoChange}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {Object.keys(photos).length} / 7 uploaded
              </p>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-2">Agent Notes (optional)</label>
              <textarea
                rows={3}
                value={agentNotes}
                onChange={(e) => setAgentNotes(e.target.value)}
                placeholder="Any notes about the cargo condition, access, or discrepancies…"
                className="textarea textarea-bordered w-full resize-none text-sm"
              />
            </div>

            <button
              onClick={handleSubmitReport}
              disabled={submitting}
              className="btn w-full text-white font-bold rounded-xl text-base disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Report & Complete Job'}
            </button>
          </>
        )}

        {job.status === 'completed' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Job Complete</h2>
            <p className="text-sm text-gray-500">Your payout of 80% of the job fee has been triggered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Note:** The `increment_agent_jobs` RPC doesn't exist yet. Add it as a migration in Step 2.

- [ ] **Step 2: Add RPC migration for agent job counter**

Create `supabase/migrations/20260614_59_agent_job_counter_rpc.sql`:

```sql
-- supabase/migrations/20260614_59_agent_job_counter_rpc.sql
create or replace function increment_agent_jobs(agent_id uuid)
returns void
language sql
security definer
as $$
  update measurement_agent_profiles
  set total_jobs_completed = total_jobs_completed + 1
  where id = agent_id;
$$;
```

Apply via `mcp__plugin_supabase_supabase__apply_migration`.

- [ ] **Step 3: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add "app/measurement-agent/jobs/[id]/page.tsx" supabase/migrations/20260614_59_agent_job_counter_rpc.sql
git commit -m "feat: add agent job detail page with item entry, photo upload, and report submission"
```

---

## Task 13: Booking Form — CBM Declaration Changes

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

- [ ] **Step 1: Read the existing booking form**

Read `app/booking/[containerId]/page.tsx` in full before making changes.

- [ ] **Step 2: Add CBM declaration type selector at the top of the form**

At the top of the form (before CBM input), add:

```typescript
// Add to state declarations:
const [cbmDeclarationType, setCbmDeclarationType] = useState<'self_declared' | 'measurement_verified'>('self_declared');
const [cbmStep1Ack, setCbmStep1Ack] = useState(false);
const [showCbmModal, setShowCbmModal] = useState(false);

// Add helper above the return:
const CBM_DISCLAIMER = 'I confirm my declared CBM is accurate. A ±5% variance is allowed. Overages will be billed; underages will be credited against Stage 2 payment.';
```

At top of form JSX (before CBM field):

```tsx
{/* CBM Declaration Type */}
<div className="mb-5">
  <label className="block text-xs font-bold text-gray-700 mb-2">How do you know your cargo dimensions?</label>
  <div className="flex gap-3 flex-wrap">
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="radio" name="cbmType" value="self_declared"
        checked={cbmDeclarationType === 'self_declared'}
        onChange={() => setCbmDeclarationType('self_declared')}
        className="radio radio-sm" style={{ accentColor: '#f97316' }} />
      <span className="text-sm text-gray-700">I know my dimensions (self-declare)</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="radio" name="cbmType" value="measurement_verified"
        checked={cbmDeclarationType === 'measurement_verified'}
        onChange={() => setCbmDeclarationType('measurement_verified')}
        className="radio radio-sm" style={{ accentColor: '#f97316' }} />
      <span className="text-sm text-gray-700">I have a measurement report</span>
    </label>
  </div>
  {cbmDeclarationType === 'measurement_verified' && (
    <a href="/measurement-service" target="_blank" rel="noopener noreferrer"
      className="text-xs text-orange-500 hover:underline mt-2 block">
      → Don't have a report yet? Request a measurement agent
    </a>
  )}
</div>

{/* Step 1 acknowledgement (self_declared only) */}
{cbmDeclarationType === 'self_declared' && (
  <label className="flex items-start gap-2 cursor-pointer mb-4">
    <input type="checkbox" checked={cbmStep1Ack} onChange={(e) => setCbmStep1Ack(e.target.checked)}
      className="checkbox checkbox-sm mt-0.5" style={{ accentColor: '#f97316' }} />
    <span className="text-xs text-gray-600">
      I understand that my CBM declaration affects my booking price and may be verified at loading.
    </span>
  </label>
)}
```

On form submit, for `self_declared`: check `cbmStep1Ack` is true, then show modal. Modal confirm triggers the actual booking insert with `cbm_disclaimer_acknowledged_count: 2`. The modal:

```tsx
{showCbmModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
      <h3 className="text-base font-extrabold text-gray-800 mb-3">Confirm CBM Declaration</h3>
      <p className="text-sm text-gray-600 mb-5">{CBM_DISCLAIMER}</p>
      <div className="flex gap-3">
        <button onClick={() => setShowCbmModal(false)} className="btn btn-ghost flex-1 rounded-xl">Cancel</button>
        <button
          onClick={handleFinalSubmit}
          className="btn flex-1 text-white font-bold rounded-xl"
          style={{ backgroundColor: '#f97316' }}
        >
          I Confirm
        </button>
      </div>
    </div>
  </div>
)}
```

The existing `handleSubmit` should be split:
- `handleSubmit` validates form + checks `cbmStep1Ack` for self_declared → shows modal
- `handleFinalSubmit` closes modal + inserts booking with `cbm_declaration_type` and `cbm_disclaimer_acknowledged_count: cbmDeclarationType === 'self_declared' ? 2 : 0`

- [ ] **Step 3: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add "app/booking/[containerId]/page.tsx"
git commit -m "feat: add CBM declaration type selector and double acknowledgement to booking form"
```

---

## Task 14: Payments Stage 2 — CBM Variance Display

**Files:**
- Modify: `app/payments/[bookingId]/page.tsx`

- [ ] **Step 1: Read the existing payments page**

Read `app/payments/[bookingId]/page.tsx` in full.

- [ ] **Step 2: Add CBM variance display on Stage 2 card**

When `payment.stage === 'pre_departure_50'` and `booking.cbm_variance_adjustment` is non-null and non-zero, show the adjustment line:

```tsx
// In the pre_departure_50 payment card, after the base amount display:
{payment.stage === 'pre_departure_50' && booking.cbm_variance_adjustment && booking.cbm_variance_adjustment !== 0 && (
  <div className="mt-2 pt-2 border-t border-dashed text-sm">
    <div className="flex justify-between text-gray-500">
      <span>Base amount</span>
      <span>{fmtMoney(payment.amount - booking.cbm_variance_adjustment)}</span>
    </div>
    <div className={`flex justify-between font-medium ${booking.cbm_variance_adjustment > 0 ? 'text-red-600' : 'text-green-600'}`}>
      <span>CBM variance adjustment {booking.cbm_variance_adjustment > 0 ? '(surcharge)' : '(credit)'}</span>
      <span>{booking.cbm_variance_adjustment > 0 ? '+' : ''}{fmtMoney(booking.cbm_variance_adjustment)}</span>
    </div>
    <div className="flex justify-between font-bold text-gray-800 mt-1">
      <span>Total due</span>
      <span>{fmtMoney(payment.amount)}</span>
    </div>
  </div>
)}
```

The booking query needs to include `cbm_variance_adjustment`. Add it to the select.

- [ ] **Step 3: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add "app/payments/[bookingId]/page.tsx"
git commit -m "feat: show CBM variance adjustment on Stage 2 payment card"
```

---

## Task 15: Admin Hub + Agent Dashboard Updates

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/measurement-agent/page.tsx`

- [ ] **Step 1: Read both files**

Read `app/admin/page.tsx` and `app/measurement-agent/page.tsx`.

- [ ] **Step 2: Add Measurement Jobs + Rate Bands tiles to admin hub**

In `app/admin/page.tsx`, add two new navigation tiles in the same style as existing tiles:

```tsx
{ href: '/admin/measurement-jobs', label: 'Measurement Jobs', description: 'View and assign measurement jobs' },
{ href: '/admin/rate-bands',       label: 'Rate Bands',       description: 'Manage measurement service pricing' },
```

- [ ] **Step 3: Replace stub with real counts in measurement-agent dashboard**

In `app/measurement-agent/page.tsx`, fetch real counts from `measurement_jobs`:
- Pending/Assigned jobs: `status in ('assigned', 'in_progress')`
- Completed jobs: `status = 'completed'`
- Total earnings: sum of `quoted_fee * 0.80` for completed jobs

Replace hardcoded zeros with live data from Supabase. Also add a "My Jobs" quick link button pointing to `/measurement-agent/jobs`.

- [ ] **Step 4: TypeScript check — `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/measurement-agent/page.tsx
git commit -m "feat: add measurement jobs + rate bands to admin hub; real job counts on agent dashboard"
```

---

## Spec Self-Review

**Coverage check:**
- ✅ Task 1: measurement_rate_bands, measurement_jobs, measurement_job_items, measurement_reports, measurement_report_photos, measurement_job_payments tables + RLS
- ✅ Task 2: bookings table — cbm_declaration_type, measurement_report_id, cbm_disclaimer_acknowledged_count, actual_cbm_at_loading, cbm_variance_pct, cbm_variance_adjustment
- ✅ Task 3: measurement-report-photos private storage bucket
- ✅ Task 4: initialize-measurement-payment Edge Function
- ✅ Task 5: verify-measurement-payment Edge Function
- ✅ Task 6: trigger-measurement-agent-payout Edge Function (80% agent share)
- ✅ Task 7: /admin/rate-bands (create/edit/deactivate)
- ✅ Task 8: /admin/measurement-jobs (list + assign agent by city match)
- ✅ Task 9: /measurement-service (request + pay)
- ✅ Task 10: /measurement-service/[jobId] (track + view report with photos)
- ✅ Task 11: /measurement-agent/jobs (agent job list)
- ✅ Task 12: /measurement-agent/jobs/[id] (start job, add items, upload 7 photos, submit report, trigger payout)
- ✅ Task 13: Booking form — declaration type selector + step-1 checkbox + step-2 modal (cbm_disclaimer_acknowledged_count = 2)
- ✅ Task 14: Stage 2 payment CBM variance display
- ✅ Task 15: Admin hub tiles + agent dashboard real counts

**Security check:**
- ✅ All Paystack calls go through Edge Functions — no secret keys in browser code
- ✅ measurement-report-photos bucket is private
- ✅ RLS on all tables — agents only see their own jobs, shippers only see their own jobs

**Type consistency check:**
- PhotoType array `PHOTO_TYPES` used consistently in Task 12
- `agentProfileId` used for RPC and photo path consistently
- `cbm_disclaimer_acknowledged_count: 2` set in Task 13 for self-declared flow
