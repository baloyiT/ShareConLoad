# Operator Compliance Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent operators from creating containers unless all 5 compliance steps are satisfied: Profile, Contact, Account (bank/Paystack), Documents (6 required docs approved), and Service Agreement.

**Architecture:** A Postgres function `operator_is_compliant(op_id uuid)` encodes the 5 conditions and is stored for future DB-level enforcement. The immediate gate is frontend-only: on load, `/operator/create` queries the operator's profile and compliance documents, computes compliance, and renders either the locked state or the existing form. No changes to form submit logic or container RLS are made — the frontend gate is the enforcement layer for now.

**Tech Stack:** Supabase (PostgreSQL), Next.js App Router, TypeScript, Tailwind CSS / DaisyUI

---

## Compliance Conditions

| Step | DB condition |
|---|---|
| Profile | `operator_profiles.legal_name IS NOT NULL` |
| Contact | `operator_profiles.phone_number IS NOT NULL` |
| Account | `operator_profiles.paystack_recipient_code IS NOT NULL` |
| Documents | 6 required doc types (`identity`, `business_registration`, `proof_of_warehouse_address`, `tax_clearance`, `banking_confirmation`, `cargo_insurance`) all have `status = 'approved'` in `compliance_documents` |
| Service Agreement | `operator_profiles.service_agreement_signed_at IS NOT NULL` |

---

## Files

| Action | Path |
|---|---|
| Create | `supabase/migrations/20260514_17_operator_compliance_gate.sql` |
| Modify | `app/operator/create/page.tsx` |

---

### Task 1: Create the compliance function migration

**Files:**
- Create: `supabase/migrations/20260514_17_operator_compliance_gate.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260514_17_operator_compliance_gate.sql` with exactly this content:

```sql
-- Encodes all 5 operator compliance conditions in one place.
-- security invoker: runs as the calling user, so operator RLS on
-- compliance_documents and operator_profiles applies naturally.
-- Used by the frontend for pre-create checks; ready for containers
-- INSERT RLS once that table's full policy set is confirmed.

create or replace function public.operator_is_compliant(op_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select
    op.legal_name                   is not null
    and op.phone_number             is not null
    and op.paystack_recipient_code  is not null
    and op.service_agreement_signed_at is not null
    and (
      select count(*)
      from public.compliance_documents cd
      where cd.operator_profile_id = op.id
        and cd.doc_type in (
          'identity',
          'business_registration',
          'proof_of_warehouse_address',
          'tax_clearance',
          'banking_confirmation',
          'cargo_insurance'
        )
        and cd.status = 'approved'
    ) = 6
  from public.operator_profiles op
  where op.id = op_id;
$$;

grant execute on function public.operator_is_compliant(uuid) to authenticated;
```

- [ ] **Step 2: Apply the migration in Supabase**

Open **Supabase Dashboard → SQL Editor** and paste + run the full file content. Expected output:

```
Success. No rows returned.
```

- [ ] **Step 3: Verify the function exists**

In the SQL Editor, run:

```sql
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'operator_is_compliant';
```

Expected:

| routine_name           | security_type |
|------------------------|---------------|
| operator_is_compliant  | INVOKER       |

- [ ] **Step 4: Smoke-test the function**

```sql
select public.operator_is_compliant('00000000-0000-0000-0000-000000000000');
```

Expected: one row with value `false` (the UUID doesn't exist, so the subquery returns NULL which coerces to false). A SQL error means a syntax problem — re-check the migration.

- [ ] **Step 5: Commit the migration**

```bash
git add supabase/migrations/20260514_17_operator_compliance_gate.sql
git commit -m "feat: add operator_is_compliant function for compliance gate"
```

---

### Task 2: Add compliance gate to the create container page

**Files:**
- Modify: `app/operator/create/page.tsx`

**Context:** The file currently has no `useEffect` — it is a pure form with no data loading. The compliance check requires an auth lookup and two Supabase queries. The page renders three possible states after this change: `'loading'`, `'blocked'`, or `'ok'`.

- [ ] **Step 1: Add the compliance state and useEffect**

At the top of the `CreateContainerPage` function body, after the existing state declarations, add:

```tsx
const [compliance, setCompliance] = useState<'loading' | 'ok' | 'blocked'>('loading');

useEffect(() => {
  async function checkCompliance() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login?next=/operator/create'); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role_type', 'operator')
      .single();

    if (!profile) { setCompliance('blocked'); return; }

    const { data: op } = await supabase
      .from('operator_profiles')
      .select('id, legal_name, phone_number, paystack_recipient_code, service_agreement_signed_at')
      .eq('profile_id', profile.id)
      .single();

    if (!op) { setCompliance('blocked'); return; }

    const { count } = await supabase
      .from('compliance_documents')
      .select('id', { count: 'exact', head: true })
      .eq('operator_profile_id', op.id)
      .in('doc_type', ['identity', 'business_registration', 'proof_of_warehouse_address', 'tax_clearance', 'banking_confirmation', 'cargo_insurance'])
      .eq('status', 'approved');

    const compliant =
      !!op.legal_name &&
      !!op.phone_number &&
      !!op.paystack_recipient_code &&
      !!op.service_agreement_signed_at &&
      (count ?? 0) === 6;

    setCompliance(compliant ? 'ok' : 'blocked');
  }
  checkCompliance();
}, [router]);
```

Also add `useEffect` to the import at line 3 — change:

```tsx
import { useState } from 'react';
```

to:

```tsx
import { useEffect, useState } from 'react';
```

- [ ] **Step 2: Add the loading and blocked render branches**

Before the `// ── Success screen` block (the `if (createdId)` block), add these two new early returns:

```tsx
// ── Compliance loading ──────────────────────────────────────────────────────
if (compliance === 'loading') {
  return (
    <div className="flex items-center justify-center py-24 min-h-[60vh]">
      <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
    </div>
  );
}

// ── Compliance blocked ──────────────────────────────────────────────────────
if (compliance === 'blocked') {
  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <div className="relative overflow-hidden py-10 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.15 }}>
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="relative max-w-4xl mx-auto z-10">
          <p className="text-gray-400 text-sm mb-1 font-medium">Operator Portal</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Create a Container</h1>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#fff7ed' }}
          >
            <svg className="w-8 h-8" style={{ color: '#f97316' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a5 5 0 00-5 5v1H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2h-2v-1a5 5 0 00-5-5z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-800 mb-2">Compliance Required</h2>
          <p className="text-gray-500 text-sm mb-1">
            You must complete your compliance profile before listing containers.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            All five steps must be approved: Profile, Contact, Account, Documents, and Service Agreement.
          </p>
          <Link
            href="/operator/compliance/profile"
            className="btn text-white font-bold rounded-xl w-full hover:opacity-90"
            style={{ backgroundColor: '#f97316' }}
          >
            Go to Compliance →
          </Link>
          <Link href="/operator" className="btn btn-ghost text-gray-400 rounded-xl w-full mt-2 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors). If you see errors about `compliance` or `useEffect`, double-check Step 1 — the import and state declaration.

- [ ] **Step 4: Commit the frontend changes**

```bash
git add app/operator/create/page.tsx
git commit -m "feat: block container creation until operator is fully compliant"
```

---

### Task 3: Manual verification

No automated tests — requires an authenticated operator session.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as an operator who is NOT fully compliant**

Navigate to `http://localhost:3000/operator/create`.

Expected: the locked state renders with "Compliance Required" heading and an orange "Go to Compliance →" button. The container form does NOT appear.

- [ ] **Step 3: Verify the compliance link works**

Click "Go to Compliance →". It should navigate to `/operator/compliance/profile`.

- [ ] **Step 4: Log in as a fully compliant operator (or mark one compliant in the DB)**

If you don't have a fully compliant operator, run in the SQL Editor to simulate one (replace the UUID with a real `operator_profiles.id`):

```sql
update public.operator_profiles
set
  legal_name                    = 'Test Operator Ltd',
  phone_number                  = '+27 82 000 0000',
  paystack_recipient_code       = 'RCP_test123',
  service_agreement_signed_at   = now()
where id = '<your-operator-profile-id>';

-- Then insert all 6 approved docs:
insert into public.compliance_documents (operator_profile_id, doc_type, file_url, status, uploaded_at)
values
  ('<your-operator-profile-id>', 'identity',                   'test/identity.pdf',                   'approved', now()),
  ('<your-operator-profile-id>', 'business_registration',      'test/business_registration.pdf',      'approved', now()),
  ('<your-operator-profile-id>', 'proof_of_warehouse_address', 'test/proof_of_warehouse_address.pdf', 'approved', now()),
  ('<your-operator-profile-id>', 'tax_clearance',              'test/tax_clearance.pdf',              'approved', now()),
  ('<your-operator-profile-id>', 'banking_confirmation',       'test/banking_confirmation.pdf',       'approved', now()),
  ('<your-operator-profile-id>', 'cargo_insurance',            'test/cargo_insurance.pdf',            'approved', now())
on conflict (operator_profile_id, doc_type) do update set status = 'approved';
```

- [ ] **Step 5: Verify compliant operator sees the form**

Navigate to `http://localhost:3000/operator/create` as the compliant operator.

Expected: the normal container creation form appears. The compliance check should complete quickly (one spinner flash then the form).

- [ ] **Step 6: Verify browser console has no errors**

Open DevTools → Console. No errors about missing columns, failed queries, or unhandled promises.
