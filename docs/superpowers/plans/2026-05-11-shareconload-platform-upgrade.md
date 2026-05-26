# ShareConLoad Platform Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ShareConLoad from a basic booking MVP to a full logistics marketplace with staged payments (Paystack), operator payouts, shipment milestones, compliance/customs tracking, dispute management, cargo release workflows, support tickets, and an expanded admin dashboard.

**Architecture:** Client-side Next.js (App Router) + Supabase (PostgreSQL, Auth, RLS, Edge Functions). Paystack API calls are proxied through Supabase Edge Functions — never from the browser. All new database tables follow the existing RLS pattern with role-based access.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase (PostgreSQL + Edge Functions), Paystack API

---

## Gap Analysis (Current → Target)

| Domain | Current State | Target State |
|---|---|---|
| Payments | None | 3-stage Paystack (20/50/30%) |
| Operator Payouts | None | Milestone-triggered transfers |
| Shipment Milestones | booking_status_history only | Dedicated milestones table + timeline |
| Customs/Compliance | None | customs_events, compliance_flags tables + UI |
| Cargo Release | None | cargo_release_authorizations workflow |
| Disputes | None | disputes, dispute_evidence, insurance_claims |
| Support Tickets | None | support_tickets + admin management |
| Audit Logs | None | audit_logs table + service |
| Admin Dashboard | Stub page | Full operator/booking/payout/dispute management |
| Notifications | DB channel only | Payment reminders, customs alerts |

---

## File Map

### New SQL Migrations
- `supabase/migrations/20260511_01_payments_payouts.sql`
- `supabase/migrations/20260511_02_shipment_milestones.sql`
- `supabase/migrations/20260511_03_disputes_claims.sql`
- `supabase/migrations/20260511_04_customs_compliance.sql`
- `supabase/migrations/20260511_05_support_audit.sql`
- `supabase/migrations/20260511_06_operator_paystack_fields.sql`
- `supabase/migrations/20260511_07_cargo_release.sql`

### New Supabase Edge Functions
- `supabase/functions/initialize-payment/index.ts`
- `supabase/functions/verify-payment/index.ts`
- `supabase/functions/paystack-webhook/index.ts`
- `supabase/functions/create-transfer-recipient/index.ts`
- `supabase/functions/trigger-payout/index.ts`
- `supabase/functions/process-refund/index.ts`

### New App Pages
- `app/payments/[bookingId]/page.tsx` — customer staged payment UI
- `app/payments/history/page.tsx` — customer payment history
- `app/disputes/new/page.tsx` — customer dispute submission
- `app/disputes/[id]/page.tsx` — dispute detail/evidence upload
- `app/support/new/page.tsx` — customer support ticket form
- `app/admin/operators/page.tsx` — admin operator management
- `app/admin/bookings/page.tsx` — admin all-bookings view
- `app/admin/payouts/page.tsx` — admin payout approval
- `app/admin/disputes/page.tsx` — admin dispute management
- `app/admin/compliance/page.tsx` — admin compliance flags
- `app/admin/release/page.tsx` — admin cargo release authorization

### New Components
- `components/PaymentStageCard.tsx` — staged payment display tile
- `components/MilestoneTimeline.tsx` — enhanced shipment milestone view
- `components/DisputeForm.tsx` — dispute submission form
- `components/SupportTicketForm.tsx` — support ticket form
- `components/ComplianceFlagBadge.tsx` — compliance status indicator

### Modified Files
- `app/operator/page.tsx` — add payout status column to containers table
- `app/onboarding/operator/page.tsx` — add bank account fields for Paystack recipient
- `app/booking/[containerId]/page.tsx` — redirect to payment stage 1 after booking
- `app/booking/track/[id]/page.tsx` — replace status timeline with MilestoneTimeline
- `app/bookings/page.tsx` — add payment stage badge to booking cards
- `app/admin/page.tsx` — expand to navigation hub linking all admin sub-pages
- `services/notificationService.ts` — add payment_reminder and customs_alert event types
- `services/auditLogger.ts` — new file: audit log helper

---

# PHASE 1 — Database Schema Foundation

---

## Task 1.1: Payments & Payouts Tables

**Files:**
- Create: `supabase/migrations/20260511_01_payments_payouts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511_01_payments_payouts.sql

create type payment_stage as enum ('deposit_20', 'pre_departure_50', 'final_release_30');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type payout_status as enum ('pending', 'processing', 'completed', 'failed', 'on_hold');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stage payment_stage not null,
  amount numeric(12,2) not null,
  currency text not null default 'ZAR',
  status payment_status not null default 'pending',
  paystack_reference text,
  paystack_transaction_id text,
  paid_at timestamptz,
  due_date timestamptz,
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  operator_id uuid not null references public.profiles(id),
  stage payment_stage not null,
  gross_amount numeric(12,2) not null,
  commission_rate numeric(5,4) not null default 0.05,
  commission_amount numeric(12,2) not null,
  net_amount numeric(12,2) not null,
  status payout_status not null default 'pending',
  paystack_transfer_code text,
  paystack_recipient_code text,
  hold_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.payments enable row level security;
alter table public.payouts enable row level security;

-- Customers see own payments
create policy "customers_view_own_payments" on public.payments
  for select using (
    booking_id in (
      select id from public.bookings where customer_id = (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  );

-- Operators see payouts for their bookings
create policy "operators_view_own_payouts" on public.payouts
  for select using (
    operator_id = (select id from public.profiles where user_id = auth.uid())
  );

-- Admins full access (role check via profiles)
create policy "admins_all_payments" on public.payments
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type = 'admin'
    )
  );

create policy "admins_all_payouts" on public.payouts
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type = 'admin'
    )
  );

-- Indexes
create index idx_payments_booking_id on public.payments(booking_id);
create index idx_payments_status on public.payments(status);
create index idx_payouts_booking_id on public.payouts(booking_id);
create index idx_payouts_operator_id on public.payouts(operator_id);
create index idx_payouts_status on public.payouts(status);
```

- [ ] **Step 2: Run in Supabase SQL editor**

Paste the full migration into Supabase Dashboard → SQL Editor → Run.
Verify: `select * from public.payments limit 1;` returns empty set with no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511_01_payments_payouts.sql
git commit -m "feat(db): add payments and payouts tables with RLS"
```

---

## Task 1.2: Shipment Milestones Table

**Files:**
- Create: `supabase/migrations/20260511_02_shipment_milestones.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511_02_shipment_milestones.sql

create type milestone_type as enum (
  'booking_confirmed',
  'cargo_received',
  'container_loaded',
  'vessel_departed',
  'customs_hold',
  'destination_arrival',
  'customs_cleared',
  'release_authorized',
  'cargo_collected',
  'shipment_completed'
);

create table public.shipment_milestones (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  milestone milestone_type not null,
  notes text,
  recorded_by uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.shipment_milestones enable row level security;

-- Customers see milestones for their bookings
create policy "customers_view_own_milestones" on public.shipment_milestones
  for select using (
    booking_id in (
      select id from public.bookings where customer_id = (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  );

-- Operators see milestones for bookings on their containers
create policy "operators_view_container_milestones" on public.shipment_milestones
  for select using (
    booking_id in (
      select b.id from public.bookings b
      join public.containers c on c.id = b.container_id
      where c.operator_id = (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  );

-- Admins and operators can insert milestones
create policy "operators_insert_milestones" on public.shipment_milestones
  for insert with check (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type in ('admin', 'operator')
    )
  );

create policy "admins_all_milestones" on public.shipment_milestones
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type = 'admin'
    )
  );

create index idx_milestones_booking_id on public.shipment_milestones(booking_id);
create index idx_milestones_occurred_at on public.shipment_milestones(occurred_at);
```

- [ ] **Step 2: Run in Supabase SQL editor, verify no errors**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511_02_shipment_milestones.sql
git commit -m "feat(db): add shipment_milestones table with RLS"
```

---

## Task 1.3: Disputes, Evidence & Insurance Claims Tables

**Files:**
- Create: `supabase/migrations/20260511_03_disputes_claims.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511_03_disputes_claims.sql

create type dispute_type as enum (
  'cargo_damage', 'cargo_missing', 'shipment_delay',
  'customs_issue', 'refund_request', 'operator_conduct'
);
create type dispute_status as enum (
  'submitted', 'under_review', 'awaiting_evidence',
  'resolved_customer', 'resolved_operator', 'closed'
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  dispute_type dispute_type not null,
  description text not null,
  status dispute_status not null default 'submitted',
  resolution_notes text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_url text not null,
  file_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  dispute_id uuid references public.disputes(id),
  submitted_by uuid not null references public.profiles(id),
  claim_amount numeric(12,2),
  description text not null,
  status text not null default 'submitted',
  insurer_reference text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.insurance_claims enable row level security;

-- Customers see own disputes
create policy "customers_view_own_disputes" on public.disputes
  for select using (submitted_by = (select id from public.profiles where user_id = auth.uid()));

create policy "customers_insert_disputes" on public.disputes
  for insert with check (submitted_by = (select id from public.profiles where user_id = auth.uid()));

-- Dispute evidence: parties and admin
create policy "dispute_parties_view_evidence" on public.dispute_evidence
  for select using (
    dispute_id in (
      select id from public.disputes
      where submitted_by = (select id from public.profiles where user_id = auth.uid())
    )
    or exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin')
  );

create policy "dispute_parties_upload_evidence" on public.dispute_evidence
  for insert with check (
    uploaded_by = (select id from public.profiles where user_id = auth.uid())
  );

create policy "admins_all_disputes" on public.disputes
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create policy "admins_all_dispute_evidence" on public.dispute_evidence
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create policy "customers_view_own_claims" on public.insurance_claims
  for select using (submitted_by = (select id from public.profiles where user_id = auth.uid()));

create policy "customers_insert_claims" on public.insurance_claims
  for insert with check (submitted_by = (select id from public.profiles where user_id = auth.uid()));

create policy "admins_all_claims" on public.insurance_claims
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create index idx_disputes_booking_id on public.disputes(booking_id);
create index idx_disputes_status on public.disputes(status);
create index idx_dispute_evidence_dispute_id on public.dispute_evidence(dispute_id);
create index idx_insurance_claims_booking_id on public.insurance_claims(booking_id);
```

- [ ] **Step 2: Run in Supabase SQL editor, verify no errors**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511_03_disputes_claims.sql
git commit -m "feat(db): add disputes, dispute_evidence, insurance_claims tables"
```

---

## Task 1.4: Customs Events & Compliance Flags

**Files:**
- Create: `supabase/migrations/20260511_04_customs_compliance.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511_04_customs_compliance.sql

create type customs_event_type as enum (
  'inspection', 'hold', 'released', 'duty_pending',
  'documents_requested', 'seized', 'cleared'
);

create type compliance_flag_type as enum (
  'prohibited_cargo', 'sanctions_risk', 'suspicious_payment',
  'customs_risk', 'fraud_risk', 'unverified_identity'
);

create table public.customs_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type customs_event_type not null,
  description text,
  recorded_by uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.compliance_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('booking', 'profile', 'operator_profile')),
  target_id uuid not null,
  flag_type compliance_flag_type not null,
  description text,
  raised_by uuid references public.profiles(id),
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customs_events enable row level security;
alter table public.compliance_flags enable row level security;

-- Customers see customs events for their bookings
create policy "customers_view_customs_events" on public.customs_events
  for select using (
    booking_id in (
      select id from public.bookings where customer_id = (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  );

-- Admins full access
create policy "admins_all_customs_events" on public.customs_events
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create policy "admins_all_compliance_flags" on public.compliance_flags
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create index idx_customs_events_booking_id on public.customs_events(booking_id);
create index idx_compliance_flags_target_id on public.compliance_flags(target_id);
create index idx_compliance_flags_resolved on public.compliance_flags(resolved);
```

- [ ] **Step 2: Run in Supabase SQL editor, verify no errors**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511_04_customs_compliance.sql
git commit -m "feat(db): add customs_events and compliance_flags tables"
```

---

## Task 1.5: Support Tickets & Audit Logs

**Files:**
- Create: `supabase/migrations/20260511_05_support_audit.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511_05_support_audit.sql

create type ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type ticket_priority as enum ('low', 'medium', 'high', 'critical');

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id) on delete set null,
  subject text not null,
  description text not null,
  status ticket_status not null default 'open',
  priority ticket_priority not null default 'medium',
  assigned_to uuid references public.profiles(id),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;

create policy "customers_view_own_tickets" on public.support_tickets
  for select using (submitted_by = (select id from public.profiles where user_id = auth.uid()));

create policy "customers_insert_tickets" on public.support_tickets
  for insert with check (submitted_by = (select id from public.profiles where user_id = auth.uid()));

create policy "admins_all_tickets" on public.support_tickets
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

-- Audit logs: admin read only, service inserts via service_role key
create policy "admins_view_audit_logs" on public.audit_logs
  for select using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create index idx_support_tickets_submitted_by on public.support_tickets(submitted_by);
create index idx_support_tickets_status on public.support_tickets(status);
create index idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index idx_audit_logs_target_id on public.audit_logs(target_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at);
```

- [ ] **Step 2: Run in Supabase SQL editor, verify no errors**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511_05_support_audit.sql
git commit -m "feat(db): add support_tickets and audit_logs tables"
```

---

## Task 1.6: Operator Paystack Fields & Cargo Release

**Files:**
- Create: `supabase/migrations/20260511_06_operator_paystack_fields.sql`
- Create: `supabase/migrations/20260511_07_cargo_release.sql`

- [ ] **Step 1: Write operator extension migration**

```sql
-- supabase/migrations/20260511_06_operator_paystack_fields.sql

alter table public.operator_profiles
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_code text,
  add column if not exists paystack_recipient_code text,
  add column if not exists payout_enabled boolean not null default false,
  add column if not exists payout_hold boolean not null default false,
  add column if not exists payout_hold_reason text;
```

- [ ] **Step 2: Write cargo release migration**

```sql
-- supabase/migrations/20260511_07_cargo_release.sql

create type release_status as enum ('pending', 'authorized', 'released', 'held');

create table public.cargo_release_authorizations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  final_payment_confirmed boolean not null default false,
  customs_cleared boolean not null default false,
  consignee_verified boolean not null default false,
  operator_confirmed boolean not null default false,
  status release_status not null default 'pending',
  authorized_by uuid references public.profiles(id),
  authorized_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cargo_release_authorizations enable row level security;

create policy "customers_view_own_release" on public.cargo_release_authorizations
  for select using (
    booking_id in (
      select id from public.bookings where customer_id = (
        select id from public.profiles where user_id = auth.uid()
      )
    )
  );

create policy "admins_all_release" on public.cargo_release_authorizations
  for all using (exists (select 1 from public.profiles where user_id = auth.uid() and role_type = 'admin'));

create unique index idx_cargo_release_booking_id on public.cargo_release_authorizations(booking_id);
```

- [ ] **Step 3: Run both migrations in Supabase SQL editor, verify no errors**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260511_06_operator_paystack_fields.sql supabase/migrations/20260511_07_cargo_release.sql
git commit -m "feat(db): add operator Paystack fields and cargo release authorization table"
```

---

# PHASE 2 — Paystack Edge Functions

> **Prerequisites:** Paystack account with live payments and transfers enabled. Set these Supabase secrets before deploying Edge Functions:
> ```
> supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
> supabase secrets set PAYSTACK_WEBHOOK_SECRET=whsec_xxx
> ```

---

## Task 2.1: Initialize Payment Edge Function

**Files:**
- Create: `supabase/functions/initialize-payment/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/initialize-payment/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { booking_id, stage } = await req.json() as { booking_id: string; stage: string }

  // Fetch the pending payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*, bookings(customer_id, profiles(user_id))')
    .eq('booking_id', booking_id)
    .eq('stage', stage)
    .eq('status', 'pending')
    .single()

  if (paymentError || !payment) {
    return new Response(JSON.stringify({ error: 'Payment record not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const amountKobo = Math.round(payment.amount * 100)
  const reference = `SCL-${payment.id}`

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountKobo,
      reference,
      metadata: {
        payment_id: payment.id,
        booking_id,
        stage,
        custom_fields: [
          { display_name: 'Booking', variable_name: 'booking_id', value: booking_id },
          { display_name: 'Payment Stage', variable_name: 'stage', value: stage },
        ]
      },
      callback_url: `${Deno.env.get('APP_URL')}/payments/${booking_id}?stage=${stage}&verified=1`,
    })
  })

  const paystackData = await paystackRes.json()

  if (!paystackData.status) {
    return new Response(JSON.stringify({ error: paystackData.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Store the Paystack reference on the payment row
  await supabase.from('payments')
    .update({ paystack_reference: reference })
    .eq('id', payment.id)

  return new Response(JSON.stringify({
    authorization_url: paystackData.data.authorization_url,
    reference,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy initialize-payment --no-verify-jwt
```

Wait for: `Deployed initialize-payment`

- [ ] **Step 3: Test with curl**

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/initialize-payment \
  -H "Authorization: Bearer <customer-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"<uuid>","stage":"deposit_20"}'
```

Expected: `{"authorization_url":"https://checkout.paystack.com/...","reference":"SCL-..."}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/initialize-payment/index.ts
git commit -m "feat(payments): add initialize-payment edge function"
```

---

## Task 2.2: Verify Payment Edge Function

**Files:**
- Create: `supabase/functions/verify-payment/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/verify-payment/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { reference } = await req.json() as { reference: string }

  const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` }
  })

  const paystackData = await paystackRes.json()

  if (!paystackData.status || paystackData.data.status !== 'success') {
    return new Response(JSON.stringify({ error: 'Payment not successful' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { payment_id, booking_id, stage } = paystackData.data.metadata

  // Use service role for write operations
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await adminSupabase.from('payments').update({
    status: 'paid',
    paystack_transaction_id: String(paystackData.data.id),
    paid_at: new Date().toISOString(),
  }).eq('id', payment_id).eq('status', 'pending')

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to update payment' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Update booking payment_status based on stage
  const stageToStatus: Record<string, string> = {
    deposit_20: 'deposit_paid',
    pre_departure_50: 'stage2_paid',
    final_release_30: 'fully_paid',
  }

  await adminSupabase.from('bookings')
    .update({ payment_status: stageToStatus[stage] })
    .eq('id', booking_id)

  await adminSupabase.from('audit_logs').insert({
    action: 'payment_verified',
    target_type: 'payment',
    target_id: payment_id,
    metadata: { reference, booking_id, stage, amount: paystackData.data.amount / 100 }
  })

  return new Response(JSON.stringify({ success: true, stage }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy verify-payment --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/verify-payment/index.ts
git commit -m "feat(payments): add verify-payment edge function"
```

---

## Task 2.3: Paystack Webhook Handler

**Files:**
- Create: `supabase/functions/paystack-webhook/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/paystack-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

Deno.serve(async (req) => {
  const signature = req.headers.get('x-paystack-signature') ?? ''
  const body = await req.text()

  const hash = createHmac('sha512', Deno.env.get('PAYSTACK_SECRET_KEY')!)
    .update(body)
    .digest('hex')

  if (hash !== signature) {
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(body) as { event: string; data: Record<string, unknown> }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await adminSupabase.from('audit_logs').insert({
    action: `webhook_${event.event}`,
    target_type: 'paystack_event',
    metadata: { event: event.event, data: event.data }
  })

  if (event.event === 'charge.success') {
    const { metadata, reference, id: transactionId, amount } = event.data as {
      metadata: { payment_id: string; booking_id: string; stage: string }
      reference: string
      id: number
      amount: number
    }

    await adminSupabase.from('payments').update({
      status: 'paid',
      paystack_transaction_id: String(transactionId),
      paid_at: new Date().toISOString(),
    }).eq('id', metadata.payment_id).eq('status', 'pending')

    const stageToStatus: Record<string, string> = {
      deposit_20: 'deposit_paid',
      pre_departure_50: 'stage2_paid',
      final_release_30: 'fully_paid',
    }

    await adminSupabase.from('bookings')
      .update({ payment_status: stageToStatus[metadata.stage] })
      .eq('id', metadata.booking_id)
  }

  if (event.event === 'transfer.success' || event.event === 'transfer.failed') {
    const { transfer_code, status } = event.data as { transfer_code: string; status: string }
    await adminSupabase.from('payouts').update({
      status: event.event === 'transfer.success' ? 'completed' : 'failed',
      paid_at: event.event === 'transfer.success' ? new Date().toISOString() : null,
    }).eq('paystack_transfer_code', transfer_code)
  }

  return new Response('OK', { status: 200 })
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy paystack-webhook --no-verify-jwt
```

- [ ] **Step 3: Configure webhook URL in Paystack Dashboard**

Go to Paystack Dashboard → Settings → API Keys & Webhooks.
Set webhook URL to: `https://<project-ref>.supabase.co/functions/v1/paystack-webhook`

Enable events: `charge.success`, `transfer.success`, `transfer.failed`, `refund.processed`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/paystack-webhook/index.ts
git commit -m "feat(payments): add paystack-webhook edge function"
```

---

## Task 2.4: Create Transfer Recipient Edge Function

**Files:**
- Create: `supabase/functions/create-transfer-recipient/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/create-transfer-recipient/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { operator_profile_id } = await req.json() as { operator_profile_id: string }

  const { data: op } = await supabase
    .from('operator_profiles')
    .select('legal_name, bank_account_name, bank_account_number, bank_code')
    .eq('id', operator_profile_id)
    .single()

  if (!op?.bank_account_number) {
    return new Response(JSON.stringify({ error: 'Bank account details not set' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const paystackRes = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'nuban',
      name: op.bank_account_name,
      account_number: op.bank_account_number,
      bank_code: op.bank_code,
      currency: 'ZAR',
    })
  })

  const paystackData = await paystackRes.json()

  if (!paystackData.status) {
    return new Response(JSON.stringify({ error: paystackData.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  await adminSupabase.from('operator_profiles').update({
    paystack_recipient_code: paystackData.data.recipient_code,
    payout_enabled: true,
  }).eq('id', operator_profile_id)

  return new Response(JSON.stringify({ recipient_code: paystackData.data.recipient_code }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy create-transfer-recipient --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-transfer-recipient/index.ts
git commit -m "feat(payments): add create-transfer-recipient edge function"
```

---

## Task 2.5: Trigger Payout Edge Function

**Files:**
- Create: `supabase/functions/trigger-payout/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/trigger-payout/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COMMISSION_RATE = 0.05

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Admin-only
  const { data: profile } = await supabase
    .from('profiles')
    .select('role_type')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (profile?.role_type !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  const { payout_id } = await req.json() as { payout_id: string }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: payout } = await adminSupabase
    .from('payouts')
    .select('*, operator_profiles!operator_id(paystack_recipient_code, payout_enabled, payout_hold)')
    .eq('id', payout_id)
    .single()

  if (!payout) return new Response('Payout not found', { status: 404, headers: corsHeaders })

  const op = payout.operator_profiles
  if (!op.payout_enabled || op.payout_hold || !op.paystack_recipient_code) {
    return new Response(JSON.stringify({ error: 'Operator not eligible for payout' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const amountKobo = Math.round(payout.net_amount * 100)

  const paystackRes = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: amountKobo,
      recipient: op.paystack_recipient_code,
      reason: `ShareConLoad payout - ${payout.stage}`,
    })
  })

  const paystackData = await paystackRes.json()

  if (!paystackData.status) {
    return new Response(JSON.stringify({ error: paystackData.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  await adminSupabase.from('payouts').update({
    status: 'processing',
    paystack_transfer_code: paystackData.data.transfer_code,
  }).eq('id', payout_id)

  return new Response(JSON.stringify({ transfer_code: paystackData.data.transfer_code }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy trigger-payout --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/trigger-payout/index.ts
git commit -m "feat(payments): add trigger-payout edge function"
```

---

## Task 2.6: Process Refund Edge Function

**Files:**
- Create: `supabase/functions/process-refund/index.ts`

- [ ] **Step 1: Create the function**

```typescript
// supabase/functions/process-refund/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('role_type')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (profile?.role_type !== 'admin') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  const { payment_id, amount } = await req.json() as { payment_id: string; amount?: number }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: payment } = await adminSupabase
    .from('payments')
    .select('*')
    .eq('id', payment_id)
    .eq('status', 'paid')
    .single()

  if (!payment?.paystack_transaction_id) {
    return new Response(JSON.stringify({ error: 'Paid payment not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const refundAmount = amount ? Math.round(amount * 100) : undefined

  const body: Record<string, unknown> = {
    transaction: payment.paystack_transaction_id,
  }
  if (refundAmount) body.amount = refundAmount

  const paystackRes = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  })

  const paystackData = await paystackRes.json()

  if (!paystackData.status) {
    return new Response(JSON.stringify({ error: paystackData.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  await adminSupabase.from('payments').update({ status: 'refunded' }).eq('id', payment_id)

  await adminSupabase.from('audit_logs').insert({
    action: 'refund_processed',
    target_type: 'payment',
    target_id: payment_id,
    metadata: { refund_data: paystackData.data }
  })

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy process-refund --no-verify-jwt
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/process-refund/index.ts
git commit -m "feat(payments): add process-refund edge function"
```

---

# PHASE 3 — Payment Trigger on Booking + Seed Records

## Task 3.1: Auto-generate Payment Records on Booking

The DDD specifies a DB trigger that auto-creates staged payment records when a booking is made.

**Files:**
- Create: `supabase/migrations/20260511_08_payment_schedule_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260511_08_payment_schedule_trigger.sql

create or replace function generate_payment_schedule()
returns trigger language plpgsql security definer as $$
begin
  insert into public.payments (booking_id, stage, amount, due_date)
  values
    (NEW.id, 'deposit_20', NEW.total_price * 0.20, now() + interval '24 hours'),
    (NEW.id, 'pre_departure_50', NEW.total_price * 0.50, null),
    (NEW.id, 'final_release_30', NEW.total_price * 0.30, null);
  return NEW;
end;
$$;

create trigger trg_generate_payment_schedule
  after insert on public.bookings
  for each row execute procedure generate_payment_schedule();
```

- [ ] **Step 2: Run in Supabase SQL editor**

Test by inserting a test booking and verifying 3 payment rows appear in the payments table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260511_08_payment_schedule_trigger.sql
git commit -m "feat(db): trigger auto-generates 3-stage payment schedule on booking creation"
```

---

## Task 3.2: Customer Payment Page UI

**Files:**
- Create: `app/payments/[bookingId]/page.tsx`

- [ ] **Step 1: Create the payment page**

```typescript
// app/payments/[bookingId]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/services/supabaseClient'

type Payment = {
  id: string
  stage: 'deposit_20' | 'pre_departure_50' | 'final_release_30'
  amount: number
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  paid_at: string | null
  due_date: string | null
}

type Booking = {
  id: string
  total_price: number
  total_cbm: number
  status: string
  payment_status: string | null
}

const STAGE_LABELS: Record<Payment['stage'], string> = {
  deposit_20: 'Stage 1 — 20% Booking Deposit',
  pre_departure_50: 'Stage 2 — 50% Pre-Departure',
  final_release_30: 'Stage 3 — 30% Final Release',
}

export default function BookingPaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<Payment[]>([])
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from('bookings').select('id,total_price,total_cbm,status,payment_status').eq('id', bookingId).single(),
        supabase.from('payments').select('*').eq('booking_id', bookingId).order('created_at'),
      ])
      setBooking(b)
      setPayments(p ?? [])
      setLoading(false)
    }
    load()
  }, [bookingId])

  useEffect(() => {
    const ref = searchParams.get('reference')
    if (!ref || verifying) return
    setVerifying(true)
    const { data: { session } } = supabase.auth.getSession() as unknown as { data: { session: { access_token: string } | null } }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref })
      })
      router.replace(`/payments/${bookingId}`)
      setVerifying(false)
    })
  }, [searchParams])

  async function handlePay(payment: Payment) {
    setPaying(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/initialize-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking_id: bookingId, stage: payment.stage })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.authorization_url
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment failed')
      setPaying(false)
    }
  }

  if (loading) return <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#0f2044' }}>Payment Schedule</h1>
      {booking && (
        <p className="text-gray-500 mb-6">
          Booking total: <span className="font-semibold">R {booking.total_price.toLocaleString()}</span>
        </p>
      )}
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {verifying && <div className="alert alert-info mb-4">Verifying your payment...</div>}
      <div className="flex flex-col gap-4">
        {payments.map((p, i) => (
          <div key={p.id} className="card bg-base-100 border border-base-200 shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{STAGE_LABELS[p.stage]}</h3>
                  <p className="text-2xl font-bold mt-1">R {p.amount.toLocaleString()}</p>
                </div>
                <span className={`badge badge-lg ${p.status === 'paid' ? 'badge-success' : p.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                  {p.status}
                </span>
              </div>
              {p.status === 'pending' && i === payments.findIndex(x => x.status === 'pending') && (
                <div className="card-actions justify-end mt-2">
                  <button
                    className="btn text-white"
                    style={{ backgroundColor: '#f97316' }}
                    onClick={() => handlePay(p)}
                    disabled={paying}
                  >
                    {paying ? <span className="loading loading-spinner loading-sm" /> : `Pay R ${p.amount.toLocaleString()}`}
                  </button>
                </div>
              )}
              {p.paid_at && (
                <p className="text-xs text-gray-400 mt-1">Paid {new Date(p.paid_at).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_SUPABASE_URL` to `.env.local` if not already set**

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
APP_URL=http://localhost:3000
```

- [ ] **Step 3: Run dev server and manually navigate to `/payments/<booking-uuid>`**

Expected: Three payment stage cards. First pending card shows "Pay R X" button.

- [ ] **Step 4: Commit**

```bash
git add app/payments/[bookingId]/page.tsx
git commit -m "feat(ui): add customer payment schedule page with Paystack integration"
```

---

## Task 3.3: Redirect Booking to Payment After Submission

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

- [ ] **Step 1: Find the booking submission success handler**

In `app/booking/[containerId]/page.tsx`, locate the section after a successful booking insert — currently it shows a success screen in-page. After the insert, add a redirect:

```typescript
// After successful booking insert, replace the setSuccess(true) call:
router.push(`/payments/${bookingData.id}`)
```

Add at the top of the component:
```typescript
import { useRouter } from 'next/navigation'
// inside component:
const router = useRouter()
```

- [ ] **Step 2: Test booking flow end-to-end**

1. Go to a container detail page
2. Click "Book Space"
3. Fill out booking form and submit
4. Verify redirect to `/payments/<booking-id>`
5. Verify 3 payment cards appear

- [ ] **Step 3: Commit**

```bash
git add app/booking/[containerId]/page.tsx
git commit -m "feat(ui): redirect to payment schedule after booking creation"
```

---

## Task 3.4: Add Payment Stage Badge to My Bookings

**Files:**
- Modify: `app/bookings/page.tsx`

- [ ] **Step 1: Add payment_status to the bookings query and show a badge**

In `app/bookings/page.tsx`, find the Supabase query and add `payment_status` to the selected fields:

```typescript
// Existing select — add payment_status field:
.select('id, status, payment_status, total_cbm, total_price, created_at, containers(origin_city, origin_country, destination_city, destination_country, departure_date)')
```

Then in the booking card JSX, add a payment badge and link:

```typescript
<div className="flex items-center gap-2 mt-2">
  <span className={`badge badge-sm ${
    booking.payment_status === 'fully_paid' ? 'badge-success' :
    booking.payment_status === 'deposit_paid' || booking.payment_status === 'stage2_paid' ? 'badge-warning' :
    'badge-ghost'
  }`}>
    {booking.payment_status ?? 'Payment pending'}
  </span>
  <a href={`/payments/${booking.id}`} className="link link-primary text-xs">Manage payments</a>
</div>
```

- [ ] **Step 2: Verify booking cards show payment status and link**

- [ ] **Step 3: Commit**

```bash
git add app/bookings/page.tsx
git commit -m "feat(ui): show payment stage status on customer bookings list"
```

---

# PHASE 4 — Operator Bank Account Onboarding

## Task 4.1: Add Bank Account Fields to Operator Onboarding

**Files:**
- Modify: `app/onboarding/operator/page.tsx`

- [ ] **Step 1: Add bank account fields to the form**

In the operator onboarding form, add these fields after the existing `vat_number` field:

```typescript
// State additions:
const [bankAccountName, setBankAccountName] = useState('')
const [bankAccountNumber, setBankAccountNumber] = useState('')
const [bankCode, setBankCode] = useState('')

// JSX additions inside the form:
<div className="divider">Bank Account for Payouts</div>

<div className="form-control">
  <label className="label"><span className="label-text">Account Holder Name</span></label>
  <input
    type="text"
    className="input input-bordered"
    value={bankAccountName}
    onChange={e => setBankAccountName(e.target.value)}
    placeholder="As it appears on bank account"
  />
</div>

<div className="form-control">
  <label className="label"><span className="label-text">Account Number</span></label>
  <input
    type="text"
    className="input input-bordered"
    value={bankAccountNumber}
    onChange={e => setBankAccountNumber(e.target.value)}
  />
</div>

<div className="form-control">
  <label className="label"><span className="label-text">Bank Code</span></label>
  <input
    type="text"
    className="input input-bordered"
    value={bankCode}
    onChange={e => setBankCode(e.target.value)}
    placeholder="e.g. 632005 for ABSA"
  />
</div>
```

In the submit handler, include these fields in the `operator_profiles` insert:

```typescript
bank_account_name: bankAccountName,
bank_account_number: bankAccountNumber,
bank_code: bankCode,
```

- [ ] **Step 2: After profile creation, call create-transfer-recipient**

After the successful insert, call the edge function:

```typescript
if (operatorProfileId && bankAccountNumber) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-transfer-recipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operator_profile_id: operatorProfileId })
    })
  }
}
```

- [ ] **Step 3: Test operator onboarding with bank details, verify `paystack_recipient_code` set on operator_profiles row**

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/operator/page.tsx
git commit -m "feat(ui): add bank account fields to operator onboarding for Paystack payouts"
```

---

# PHASE 5 — Enhanced Shipment Milestones

## Task 5.1: MilestoneTimeline Component

**Files:**
- Create: `components/MilestoneTimeline.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/MilestoneTimeline.tsx
'use client'

type Milestone = {
  id: string
  milestone: string
  notes: string | null
  occurred_at: string
}

const MILESTONE_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  cargo_received: 'Cargo Received',
  container_loaded: 'Container Loaded',
  vessel_departed: 'Vessel Departed',
  customs_hold: 'Customs Hold',
  destination_arrival: 'Arrived at Destination',
  customs_cleared: 'Customs Cleared',
  release_authorized: 'Release Authorized',
  cargo_collected: 'Cargo Collected',
  shipment_completed: 'Shipment Completed',
}

const MILESTONE_ORDER = [
  'booking_confirmed', 'cargo_received', 'container_loaded', 'vessel_departed',
  'customs_hold', 'destination_arrival', 'customs_cleared',
  'release_authorized', 'cargo_collected', 'shipment_completed',
]

type Props = { milestones: Milestone[] }

export default function MilestoneTimeline({ milestones }: Props) {
  const achieved = new Set(milestones.map(m => m.milestone))
  const latestIndex = MILESTONE_ORDER.reduce((acc, m, i) => achieved.has(m) ? i : acc, -1)

  return (
    <ul className="steps steps-vertical w-full">
      {MILESTONE_ORDER.map((key, i) => {
        const record = milestones.find(m => m.milestone === key)
        const done = achieved.has(key)
        const isHold = key === 'customs_hold' && done
        return (
          <li
            key={key}
            className={`step ${done ? (isHold ? 'step-error' : 'step-success') : ''}`}
          >
            <div className="text-left">
              <p className={`font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                {MILESTONE_LABELS[key]}
              </p>
              {record && (
                <p className="text-xs text-gray-400">
                  {new Date(record.occurred_at).toLocaleDateString()}
                  {record.notes && ` — ${record.notes}`}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Update booking tracking page to use MilestoneTimeline**

In `app/booking/track/[id]/page.tsx`:

Add to Supabase query:
```typescript
const { data: milestones } = await supabase
  .from('shipment_milestones')
  .select('*')
  .eq('booking_id', id)
  .order('occurred_at')
```

Replace the existing timeline JSX with:
```typescript
import MilestoneTimeline from '@/components/MilestoneTimeline'
// ...
<MilestoneTimeline milestones={milestones ?? []} />
```

- [ ] **Step 3: Test tracking page — initially shows all steps as incomplete, then manually insert a milestone in Supabase and verify it lights up**

- [ ] **Step 4: Commit**

```bash
git add components/MilestoneTimeline.tsx app/booking/track/[id]/page.tsx
git commit -m "feat(ui): add MilestoneTimeline component and update tracking page"
```

---

## Task 5.2: Operator Can Record Milestones

**Files:**
- Modify: `app/operator/bookings/page.tsx`

- [ ] **Step 1: Add milestone recording dropdown to confirmed bookings**

In `app/operator/bookings/page.tsx`, in the booking card/row actions, add a "Record Milestone" dropdown for bookings in `confirmed`, `loaded`, or `in_transit` status:

```typescript
// Add state for milestone UI:
const [recordingMilestone, setRecordingMilestone] = useState<string | null>(null)
const [selectedMilestone, setSelectedMilestone] = useState('')
const [milestoneNotes, setMilestoneNotes] = useState('')

const OPERATOR_MILESTONES = [
  { value: 'cargo_received', label: 'Cargo Received' },
  { value: 'container_loaded', label: 'Container Loaded' },
  { value: 'vessel_departed', label: 'Vessel Departed' },
  { value: 'destination_arrival', label: 'Arrived at Destination' },
]

async function handleRecordMilestone(bookingId: string) {
  if (!selectedMilestone) return
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id!).single()
  await supabase.from('shipment_milestones').insert({
    booking_id: bookingId,
    milestone: selectedMilestone,
    notes: milestoneNotes || null,
    recorded_by: profile?.id,
  })
  setRecordingMilestone(null)
  setSelectedMilestone('')
  setMilestoneNotes('')
}
```

Add button in booking card actions:
```typescript
<button className="btn btn-sm btn-outline" onClick={() => setRecordingMilestone(booking.id)}>
  Record Milestone
</button>
```

Add modal:
```typescript
{recordingMilestone && (
  <dialog className="modal modal-open">
    <div className="modal-box">
      <h3 className="font-bold text-lg mb-4">Record Shipment Milestone</h3>
      <select className="select select-bordered w-full mb-3" value={selectedMilestone} onChange={e => setSelectedMilestone(e.target.value)}>
        <option value="">Select milestone</option>
        {OPERATOR_MILESTONES.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <textarea className="textarea textarea-bordered w-full mb-3" placeholder="Notes (optional)" value={milestoneNotes} onChange={e => setMilestoneNotes(e.target.value)} />
      <div className="modal-action">
        <button className="btn btn-ghost" onClick={() => setRecordingMilestone(null)}>Cancel</button>
        <button className="btn text-white" style={{ backgroundColor: '#f97316' }} onClick={() => handleRecordMilestone(recordingMilestone)}>Record</button>
      </div>
    </div>
  </dialog>
)}
```

- [ ] **Step 2: Test milestone recording — record a milestone on a booking, then check tracking page**

- [ ] **Step 3: Commit**

```bash
git add app/operator/bookings/page.tsx
git commit -m "feat(ui): operator can record shipment milestones from bookings dashboard"
```

---

# PHASE 6 — Dispute Management

## Task 6.1: Customer Dispute Submission

**Files:**
- Create: `app/disputes/new/page.tsx`

- [ ] **Step 1: Create the dispute form page**

```typescript
// app/disputes/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/services/supabaseClient'

type Booking = { id: string; containers: { origin_city: string; destination_city: string } }

export default function NewDisputePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookingIdParam = searchParams.get('booking_id')
  const supabase = createClient()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingId, setBookingId] = useState(bookingIdParam ?? '')
  const [disputeType, setDisputeType] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const DISPUTE_TYPES = [
    { value: 'cargo_damage', label: 'Cargo Damage' },
    { value: 'cargo_missing', label: 'Missing Cargo' },
    { value: 'shipment_delay', label: 'Shipment Delay' },
    { value: 'customs_issue', label: 'Customs Issue' },
    { value: 'refund_request', label: 'Refund Request' },
    { value: 'operator_conduct', label: 'Operator Conduct' },
  ]

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
      if (!profile) return
      const { data } = await supabase
        .from('bookings')
        .select('id, containers(origin_city, destination_city)')
        .eq('customer_id', profile.id)
        .neq('status', 'cancelled')
      setBookings((data as unknown as Booking[]) ?? [])
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
    const { error: err } = await supabase.from('disputes').insert({
      booking_id: bookingId,
      submitted_by: profile?.id,
      dispute_type: disputeType,
      description,
    })
    if (err) { setError(err.message); setSubmitting(false); return }
    router.push('/bookings')
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Submit a Dispute</h1>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="form-control">
          <label className="label"><span className="label-text">Booking</span></label>
          <select className="select select-bordered" value={bookingId} onChange={e => setBookingId(e.target.value)} required>
            <option value="">Select booking</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>
                {b.id.slice(0, 8)}... — {b.containers?.origin_city} → {b.containers?.destination_city}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Dispute Type</span></label>
          <select className="select select-bordered" value={disputeType} onChange={e => setDisputeType(e.target.value)} required>
            <option value="">Select type</option>
            {DISPUTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Description</span></label>
          <textarea
            className="textarea textarea-bordered"
            rows={5}
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            placeholder="Describe the issue in detail..."
          />
        </div>
        <button type="submit" className="btn text-white" style={{ backgroundColor: '#f97316' }} disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Dispute'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Add "Raise Dispute" link to booking cards in `app/bookings/page.tsx`**

```typescript
<a href={`/disputes/new?booking_id=${booking.id}`} className="link link-error text-xs">Raise Dispute</a>
```

- [ ] **Step 3: Test dispute submission flow end-to-end**

- [ ] **Step 4: Commit**

```bash
git add app/disputes/new/page.tsx app/bookings/page.tsx
git commit -m "feat(ui): add customer dispute submission form"
```

---

# PHASE 7 — Support Tickets

## Task 7.1: Customer Support Ticket Page

**Files:**
- Create: `app/support/new/page.tsx`

- [ ] **Step 1: Create the support form**

```typescript
// app/support/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/services/supabaseClient'

export default function NewSupportTicketPage() {
  const router = useRouter()
  const supabase = createClient()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
    const { error: err } = await supabase.from('support_tickets').insert({
      submitted_by: profile?.id,
      subject,
      description,
    })
    if (err) { setError(err.message); setSubmitting(false); return }
    router.push('/bookings')
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Contact Support</h1>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="form-control">
          <label className="label"><span className="label-text">Subject</span></label>
          <input type="text" className="input input-bordered" value={subject} onChange={e => setSubject(e.target.value)} required />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Description</span></label>
          <textarea className="textarea textarea-bordered" rows={6} value={description} onChange={e => setDescription(e.target.value)} required />
        </div>
        <button type="submit" className="btn text-white" style={{ backgroundColor: '#f97316' }} disabled={submitting}>
          {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Ticket'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/support/new/page.tsx
git commit -m "feat(ui): add customer support ticket submission page"
```

---

# PHASE 8 — Admin Dashboard Expansion

## Task 8.1: Admin Hub Page

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Replace stub with navigation hub**

```typescript
// app/admin/page.tsx
'use client'

import Link from 'next/link'

const ADMIN_SECTIONS = [
  { href: '/admin/bookings', label: 'All Bookings', description: 'View and manage all platform bookings', icon: '📦' },
  { href: '/admin/operators', label: 'Operators', description: 'Manage operator onboarding and compliance', icon: '🚢' },
  { href: '/admin/payouts', label: 'Payouts', description: 'Approve and trigger operator payouts', icon: '💰' },
  { href: '/admin/disputes', label: 'Disputes', description: 'Review and resolve shipment disputes', icon: '⚖️' },
  { href: '/admin/compliance', label: 'Compliance Flags', description: 'Review and resolve compliance flags', icon: '🚩' },
  { href: '/admin/release', label: 'Cargo Release', description: 'Authorize cargo release for completed shipments', icon: '✅' },
]

export default function AdminDashboard() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2" style={{ color: '#0f2044' }}>Admin Dashboard</h1>
      <p className="text-gray-500 mb-8">ShareConLoad platform management</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="card bg-base-100 border border-base-200 shadow hover:shadow-md transition-shadow">
            <div className="card-body">
              <div className="text-3xl mb-2">{s.icon}</div>
              <h2 className="card-title text-base">{s.label}</h2>
              <p className="text-sm text-gray-500">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): expand admin dashboard to navigation hub"
```

---

## Task 8.2: Admin Bookings Page

**Files:**
- Create: `app/admin/bookings/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/bookings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabaseClient'

type Booking = {
  id: string
  status: string
  payment_status: string | null
  total_cbm: number
  total_price: number
  created_at: string
  profiles: { user_id: string } | null
  containers: { origin_city: string; destination_city: string } | null
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      let query = supabase
        .from('bookings')
        .select('id, status, payment_status, total_cbm, total_price, created_at, profiles(user_id), containers(origin_city, destination_city)')
        .order('created_at', { ascending: false })
      if (filter !== 'all') query = query.eq('status', filter)
      const { data } = await query
      setBookings((data as unknown as Booking[]) ?? [])
      setLoading(false)
    }
    load()
  }, [filter])

  const statuses = ['all', 'pending', 'confirmed', 'loaded', 'in_transit', 'delivered', 'cancelled']

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>All Bookings</h1>
      <div className="tabs tabs-boxed mb-6">
        {statuses.map(s => (
          <button key={s} className={`tab ${filter === s ? 'tab-active' : ''}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>ID</th><th>Route</th><th>CBM</th><th>Total</th><th>Status</th><th>Payment</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td className="font-mono text-xs">{b.id.slice(0, 8)}...</td>
                  <td>{b.containers?.origin_city} → {b.containers?.destination_city}</td>
                  <td>{b.total_cbm}</td>
                  <td>R {b.total_price.toLocaleString()}</td>
                  <td><span className="badge badge-sm">{b.status}</span></td>
                  <td><span className="badge badge-sm badge-outline">{b.payment_status ?? 'unpaid'}</span></td>
                  <td className="text-xs">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings.length === 0 && <p className="text-center text-gray-400 py-8">No bookings found</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/bookings/page.tsx
git commit -m "feat(admin): add all-bookings admin page with status filter"
```

---

## Task 8.3: Admin Payouts Page

**Files:**
- Create: `app/admin/payouts/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/payouts/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabaseClient'

type Payout = {
  id: string
  stage: string
  gross_amount: number
  net_amount: number
  status: string
  paid_at: string | null
  created_at: string
  paystack_transfer_code: string | null
  hold_reason: string | null
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('payouts')
      .select('*')
      .order('created_at', { ascending: false })
    setPayouts(data ?? [])
    setLoading(false)
  }

  async function handleTriggerPayout(payoutId: string) {
    setTriggering(payoutId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trigger-payout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_id: payoutId })
    })
    const data = await res.json()
    if (data.error) alert(data.error)
    setTriggering(null)
    load()
  }

  const statusColor: Record<string, string> = {
    pending: 'badge-warning',
    processing: 'badge-info',
    completed: 'badge-success',
    failed: 'badge-error',
    on_hold: 'badge-ghost',
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Payout Management</h1>
      {loading ? (
        <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr><th>ID</th><th>Stage</th><th>Gross</th><th>Net</th><th>Status</th><th>Transfer Code</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.id.slice(0, 8)}...</td>
                  <td>{p.stage}</td>
                  <td>R {p.gross_amount.toLocaleString()}</td>
                  <td>R {p.net_amount.toLocaleString()}</td>
                  <td><span className={`badge badge-sm ${statusColor[p.status] ?? ''}`}>{p.status}</span></td>
                  <td className="font-mono text-xs">{p.paystack_transfer_code ?? '—'}</td>
                  <td>
                    {p.status === 'pending' && (
                      <button
                        className="btn btn-xs text-white"
                        style={{ backgroundColor: '#f97316' }}
                        onClick={() => handleTriggerPayout(p.id)}
                        disabled={triggering === p.id}
                      >
                        {triggering === p.id ? <span className="loading loading-spinner loading-xs" /> : 'Trigger Payout'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.length === 0 && <p className="text-center text-gray-400 py-8">No payouts yet</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/payouts/page.tsx
git commit -m "feat(admin): add payout management page with trigger action"
```

---

## Task 8.4: Admin Disputes Page

**Files:**
- Create: `app/admin/disputes/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/disputes/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabaseClient'

type Dispute = {
  id: string
  dispute_type: string
  description: string
  status: string
  created_at: string
  resolution_notes: string | null
  bookings: { id: string; containers: { origin_city: string; destination_city: string } | null } | null
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [resolution, setResolution] = useState('')
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('disputes')
      .select('id, dispute_type, description, status, created_at, resolution_notes, bookings(id, containers(origin_city, destination_city))')
      .order('created_at', { ascending: false })
    setDisputes((data as unknown as Dispute[]) ?? [])
    setLoading(false)
  }

  async function handleResolve(disputeId: string) {
    if (!resolution) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()
    await supabase.from('disputes').update({
      status: resolution,
      resolution_notes: resolutionNotes,
      resolved_by: profile?.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', disputeId)
    setResolving(null)
    setResolutionNotes('')
    setResolution('')
    load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Dispute Management</h1>
      {loading ? (
        <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {disputes.map(d => (
            <div key={d.id} className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="badge badge-outline mr-2">{d.dispute_type.replace('_', ' ')}</span>
                    <span className={`badge ${d.status === 'submitted' ? 'badge-warning' : d.status.includes('resolved') ? 'badge-success' : 'badge-ghost'}`}>{d.status}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm mt-2">{d.description}</p>
                {d.bookings && (
                  <p className="text-xs text-gray-400">
                    Booking: {d.bookings.containers?.origin_city} → {d.bookings.containers?.destination_city}
                  </p>
                )}
                {d.status === 'submitted' || d.status === 'under_review' ? (
                  <div className="card-actions justify-end">
                    <button className="btn btn-sm btn-outline" onClick={() => setResolving(d.id)}>Resolve</button>
                  </div>
                ) : d.resolution_notes && (
                  <p className="text-xs text-gray-500 mt-1 italic">Resolution: {d.resolution_notes}</p>
                )}
              </div>
            </div>
          ))}
          {disputes.length === 0 && <p className="text-center text-gray-400 py-8">No disputes</p>}
        </div>
      )}

      {resolving && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Resolve Dispute</h3>
            <select className="select select-bordered w-full mb-3" value={resolution} onChange={e => setResolution(e.target.value)}>
              <option value="">Select outcome</option>
              <option value="resolved_customer">Resolved — favour customer</option>
              <option value="resolved_operator">Resolved — favour operator</option>
              <option value="closed">Closed — insufficient evidence</option>
            </select>
            <textarea className="textarea textarea-bordered w-full mb-3" placeholder="Resolution notes" value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setResolving(null)}>Cancel</button>
              <button className="btn text-white" style={{ backgroundColor: '#f97316' }} onClick={() => handleResolve(resolving)}>Save Resolution</button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/disputes/page.tsx
git commit -m "feat(admin): add dispute management page with resolution workflow"
```

---

## Task 8.5: Admin Operators Page

**Files:**
- Create: `app/admin/operators/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/operators/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabaseClient'

type Operator = {
  id: string
  legal_name: string
  entity_type: string
  status: string
  payout_enabled: boolean
  payout_hold: boolean
  paystack_recipient_code: string | null
  created_at: string
}

export default function AdminOperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('operator_profiles')
      .select('id, legal_name, entity_type, status, payout_enabled, payout_hold, paystack_recipient_code, created_at')
      .order('created_at', { ascending: false })
    setOperators(data ?? [])
    setLoading(false)
  }

  async function togglePayoutHold(op: Operator) {
    await supabase.from('operator_profiles').update({ payout_hold: !op.payout_hold }).eq('id', op.id)
    load()
  }

  async function togglePayoutEnabled(op: Operator) {
    await supabase.from('operator_profiles').update({ payout_enabled: !op.payout_enabled }).eq('id', op.id)
    load()
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Operator Management</h1>
      {loading ? (
        <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr><th>Name</th><th>Type</th><th>Status</th><th>Paystack</th><th>Payout Enabled</th><th>Payout Hold</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {operators.map(op => (
                <tr key={op.id}>
                  <td>{op.legal_name}</td>
                  <td>{op.entity_type}</td>
                  <td><span className="badge badge-sm">{op.status}</span></td>
                  <td>{op.paystack_recipient_code ? <span className="badge badge-success badge-sm">Linked</span> : <span className="badge badge-ghost badge-sm">Not linked</span>}</td>
                  <td><span className={`badge badge-sm ${op.payout_enabled ? 'badge-success' : 'badge-ghost'}`}>{op.payout_enabled ? 'Yes' : 'No'}</span></td>
                  <td><span className={`badge badge-sm ${op.payout_hold ? 'badge-error' : 'badge-ghost'}`}>{op.payout_hold ? 'Held' : 'Clear'}</span></td>
                  <td className="flex gap-2">
                    <button className="btn btn-xs btn-outline" onClick={() => togglePayoutEnabled(op)}>
                      {op.payout_enabled ? 'Disable' : 'Enable'} Payouts
                    </button>
                    <button className={`btn btn-xs ${op.payout_hold ? 'btn-success' : 'btn-error'}`} onClick={() => togglePayoutHold(op)}>
                      {op.payout_hold ? 'Release Hold' : 'Place Hold'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {operators.length === 0 && <p className="text-center text-gray-400 py-8">No operators</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/operators/page.tsx
git commit -m "feat(admin): add operator management page with payout hold controls"
```

---

## Task 8.6: Admin Cargo Release Page

**Files:**
- Create: `app/admin/release/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/release/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabaseClient'

type ReleaseAuth = {
  id: string
  booking_id: string
  final_payment_confirmed: boolean
  customs_cleared: boolean
  consignee_verified: boolean
  operator_confirmed: boolean
  status: string
  notes: string | null
  bookings: { containers: { origin_city: string; destination_city: string } | null } | null
}

export default function AdminReleasePage() {
  const [releases, setReleases] = useState<ReleaseAuth[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('cargo_release_authorizations')
      .select('*, bookings(containers(origin_city, destination_city))')
      .order('created_at', { ascending: false })
    setReleases((data as unknown as ReleaseAuth[]) ?? [])
    setLoading(false)
  }

  async function updateCondition(id: string, field: keyof Pick<ReleaseAuth, 'final_payment_confirmed' | 'customs_cleared' | 'consignee_verified' | 'operator_confirmed'>, value: boolean) {
    await supabase.from('cargo_release_authorizations').update({ [field]: value }).eq('id', id)
    load()
  }

  async function authorizeRelease(r: ReleaseAuth) {
    const ready = r.final_payment_confirmed && r.customs_cleared && r.consignee_verified && r.operator_confirmed
    if (!ready) { alert('All conditions must be met before authorizing release'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()
    await supabase.from('cargo_release_authorizations').update({
      status: 'authorized',
      authorized_by: profile?.id,
      authorized_at: new Date().toISOString(),
    }).eq('id', r.id)
    load()
  }

  const boolIcon = (v: boolean) => v ? '✅' : '❌'

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Cargo Release Authorization</h1>
      {loading ? (
        <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>
      ) : (
        <div className="flex flex-col gap-4">
          {releases.map(r => (
            <div key={r.id} className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body">
                <div className="flex justify-between">
                  <h3 className="font-semibold">
                    {r.bookings?.containers?.origin_city} → {r.bookings?.containers?.destination_city}
                  </h3>
                  <span className={`badge ${r.status === 'authorized' ? 'badge-success' : r.status === 'held' ? 'badge-error' : 'badge-warning'}`}>{r.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {(['final_payment_confirmed', 'customs_cleared', 'consignee_verified', 'operator_confirmed'] as const).map(field => (
                    <label key={field} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={r[field]}
                        onChange={e => updateCondition(r.id, field, e.target.checked)}
                        disabled={r.status === 'authorized'}
                      />
                      <span className="text-sm capitalize">{field.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
                {r.status === 'pending' && (
                  <div className="card-actions justify-end mt-3">
                    <button
                      className="btn btn-sm text-white"
                      style={{ backgroundColor: '#f97316' }}
                      onClick={() => authorizeRelease(r)}
                    >
                      Authorize Release
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {releases.length === 0 && <p className="text-center text-gray-400 py-8">No pending release authorizations</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/release/page.tsx
git commit -m "feat(admin): add cargo release authorization admin page"
```

---

## Task 8.7: Admin Compliance Flags Page

**Files:**
- Create: `app/admin/compliance/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/compliance/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabaseClient'

type Flag = {
  id: string
  flag_type: string
  target_type: string
  target_id: string
  description: string | null
  resolved: boolean
  created_at: string
}

export default function AdminCompliancePage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('compliance_flags')
      .select('*')
      .order('created_at', { ascending: false })
    setFlags(data ?? [])
    setLoading(false)
  }

  async function resolveFlag(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user!.id).single()
    await supabase.from('compliance_flags').update({
      resolved: true,
      resolved_by: profile?.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', id)
    load()
  }

  const FLAG_COLORS: Record<string, string> = {
    prohibited_cargo: 'badge-error',
    sanctions_risk: 'badge-error',
    suspicious_payment: 'badge-warning',
    customs_risk: 'badge-warning',
    fraud_risk: 'badge-error',
    unverified_identity: 'badge-warning',
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#0f2044' }}>Compliance Flags</h1>
      <div className="tabs tabs-boxed mb-6">
        <button className="tab tab-active">Active</button>
      </div>
      {loading ? (
        <div className="flex justify-center p-16"><span className="loading loading-spinner loading-lg text-orange-500" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.filter(f => !f.resolved).map(f => (
            <div key={f.id} className="card bg-base-100 border border-base-200 shadow-sm">
              <div className="card-body py-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center">
                    <span className={`badge ${FLAG_COLORS[f.flag_type] ?? 'badge-ghost'}`}>{f.flag_type.replace(/_/g, ' ')}</span>
                    <span className="badge badge-outline badge-sm">{f.target_type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                {f.description && <p className="text-sm mt-1">{f.description}</p>}
                <p className="font-mono text-xs text-gray-400">Target ID: {f.target_id}</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-xs btn-success" onClick={() => resolveFlag(f.id)}>Mark Resolved</button>
                </div>
              </div>
            </div>
          ))}
          {flags.filter(f => !f.resolved).length === 0 && <p className="text-center text-gray-400 py-8">No active compliance flags</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/compliance/page.tsx
git commit -m "feat(admin): add compliance flags admin page with resolve action"
```

---

# PHASE 9 — Notification Service Extensions

## Task 9.1: Add Payment & Customs Event Types to Notification Service

**Files:**
- Modify: `services/notificationService.ts`

- [ ] **Step 1: Read the current notification service to understand its event type union**

Currently `notificationService.ts` handles: `booking.created`, `booking.status_updated`, `booking.cancelled`.

Add these new event types and their message builders:

```typescript
// Add to the NotificationEvent type union:
| { type: 'payment.due'; bookingId: string; stage: string; amount: number; dueDate: string }
| { type: 'payment.confirmed'; bookingId: string; stage: string; amount: number }
| { type: 'customs.alert'; bookingId: string; eventType: string; description: string }
| { type: 'cargo.released'; bookingId: string }
| { type: 'dispute.update'; disputeId: string; status: string }
```

In the message builder switch/if block, add cases:

```typescript
case 'payment.due':
  return {
    title: 'Payment Due',
    body: `Stage ${event.stage} payment of R ${event.amount.toLocaleString()} is due by ${event.dueDate} for booking ${event.bookingId.slice(0, 8)}.`
  }
case 'payment.confirmed':
  return {
    title: 'Payment Received',
    body: `Your ${event.stage} payment of R ${event.amount.toLocaleString()} has been confirmed.`
  }
case 'customs.alert':
  return {
    title: 'Customs Update',
    body: `Customs ${event.eventType.replace(/_/g, ' ')} for your shipment: ${event.description}`
  }
case 'cargo.released':
  return {
    title: 'Cargo Released',
    body: `Your cargo for booking ${event.bookingId.slice(0, 8)} has been authorized for release. Please arrange collection.`
  }
case 'dispute.update':
  return {
    title: 'Dispute Update',
    body: `Your dispute status has been updated to: ${event.status.replace(/_/g, ' ')}.`
  }
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add services/notificationService.ts
git commit -m "feat(notifications): add payment, customs, and dispute notification event types"
```

---

# PHASE 10 — Audit Logger Service

## Task 10.1: Audit Log Helper Service

**Files:**
- Create: `services/auditLogger.ts`

- [ ] **Step 1: Create the service**

```typescript
// services/auditLogger.ts
import { createClient } from '@/services/supabaseClient'

type AuditAction =
  | 'booking_created'
  | 'booking_status_changed'
  | 'payment_initiated'
  | 'payment_verified'
  | 'payout_triggered'
  | 'refund_processed'
  | 'dispute_submitted'
  | 'dispute_resolved'
  | 'milestone_recorded'
  | 'cargo_release_authorized'
  | 'compliance_flag_raised'
  | 'compliance_flag_resolved'
  | 'support_ticket_created'

export async function logAuditEvent(
  action: AuditAction,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()

  await supabase.from('audit_logs').insert({
    actor_id: profile?.id ?? null,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  })
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add services/auditLogger.ts
git commit -m "feat(services): add audit logger service"
```

---

# PHASE 11 — Navbar Updates

## Task 11.1: Add Navigation Links for New Pages

**Files:**
- Modify: `app/page.tsx` (navbar section)

- [ ] **Step 1: Add links to new customer features in the authenticated nav**

In `app/page.tsx`, in the authenticated navigation section (the part that shows after auth check), add:

```typescript
// In the authenticated customer nav links:
<a href="/support/new" className="btn btn-ghost btn-sm">Support</a>
<a href="/disputes/new" className="btn btn-ghost btn-sm">Disputes</a>
```

And in the admin nav section:
```typescript
<a href="/admin" className="btn btn-ghost btn-sm">Admin</a>
```

- [ ] **Step 2: Verify nav links appear when logged in, hidden when logged out**

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): add support, disputes, and admin nav links"
```

---

# Post-Implementation Checklist

- [ ] All 7 SQL migrations applied to production Supabase project
- [ ] All 5 Edge Functions deployed: `initialize-payment`, `verify-payment`, `paystack-webhook`, `create-transfer-recipient`, `trigger-payout`, `process-refund`
- [ ] Paystack webhook URL configured in Paystack Dashboard
- [ ] Supabase secrets set: `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `APP_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in Vercel environment variables
- [ ] Payment schedule trigger verified with test booking
- [ ] End-to-end payment flow tested in Paystack sandbox mode
- [ ] Admin user has `role_type = 'admin'` in profiles table
- [ ] All admin pages load without 403 errors when logged in as admin
- [ ] TypeScript compiles clean: `npx tsc --noEmit`

---

# Self-Review: Spec Coverage

| Requirement | Covered In |
|---|---|
| Staged payments 20/50/30% | Task 1.1, 3.1, 3.2 |
| Paystack initialization | Task 2.1 |
| Paystack webhook verification | Task 2.3 |
| Operator payouts (Transfer API) | Task 2.5 |
| Refunds | Task 2.6 |
| Transfer recipients | Task 2.4 |
| Shipment milestones table | Task 1.2 |
| Milestone timeline UI | Task 5.1, 5.2 |
| Disputes & evidence | Task 1.3, 6.1 |
| Insurance claims table | Task 1.3 |
| Customs events | Task 1.4 |
| Compliance flags | Task 1.4, 8.7 |
| Cargo release authorization | Task 1.6, 8.6 |
| Support tickets | Task 1.5, 7.1 |
| Audit logs | Task 1.5, 10.1 |
| Operator bank account onboarding | Task 4.1 |
| Admin dashboard | Task 8.1–8.7 |
| Notification extensions | Task 9.1 |
| RLS on all new tables | Task 1.1–1.6 |
